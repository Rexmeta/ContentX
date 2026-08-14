import { eq } from "drizzle-orm";
import { db, contentsTable } from "@workspace/db";
import { newId } from "../../shared/id";
import type { Entity, GraphPayload, Relationship } from "../content/model";
import * as contentRepo from "../content/repository";
import { toContentGraph } from "../content/service";
import { validateDimensionDefinition } from "../population/dimensionModel";
import * as dimensionRepo from "../population/dimensionRepository";
import * as populationService from "../population/service";
import type {
  Distribution,
  DependencyRule,
  Population,
  PopulationProvenance,
  RuleCondition,
  RuleEffect,
} from "../population/model";

/**
 * MatrAIx import → Population domain bridge.
 *
 * The graph-centric import path (matraixService) stays untouched: it commits
 * a canonical content graph. This bridge reads that committed graph and
 * derives first-class Population domain entities from it:
 * - dimensions       → registered in the dimension registry (source "matraix")
 * - distributions    → derived deterministically from the imported personas
 * - dependency rules → implication rules derived from functional
 *                      co-occurrence between categorical dimensions
 *
 * Lineage is recorded as REFERENCES in provenance (importId/contentVersion/
 * sourceUri/matraixId), never as copies of the imported data. Derivation
 * failures are explicit errors — nothing is silently skipped or defaulted.
 */

/** Bridge input/derivation failure (→ 400/422 at the boundary). */
export class ImportBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportBridgeError";
  }
}

export interface BridgeDimensionDef {
  name: string;
  category: string;
  dataType: string;
  allowedValues: string[] | null;
  description: string;
}

export interface BridgeRuleDef {
  sourceDimension: string;
  targetDimension: string;
  type: "implication";
  conditions: RuleCondition[];
  effect: RuleEffect;
}

export interface BridgePopulationPlan {
  /** Original MatrAIx population id (from attributes.matraixId). */
  matraixId: string;
  /** Canonical graph entity id of the population. */
  entityId: string;
  name: string;
  dimensions: BridgeDimensionDef[];
  distributions: Record<string, Distribution>;
  rules: BridgeRuleDef[];
  memberCount: number;
}

interface RawDimension {
  id?: string;
  name?: string;
  category?: string;
  dataType?: string;
  allowedValues?: (string | number)[];
}

type MemberValue = string | number | boolean;

function isPlainValue(v: unknown): v is MemberValue {
  return (
    typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );
}

function memberValues(
  members: Entity[],
  dimName: string,
): MemberValue[] {
  const values: MemberValue[] = [];
  for (const m of members) {
    const v = (m.attributes ?? {})[dimName];
    if (v === undefined || v === null) continue;
    if (!isPlainValue(v)) {
      throw new ImportBridgeError(
        `Member "${m.id}" has a non-scalar value for dimension "${dimName}" — cannot derive a distribution from it.`,
      );
    }
    values.push(v);
  }
  return values;
}

function inferDataType(values: MemberValue[]): string {
  if (values.length > 0 && values.every((v) => typeof v === "number")) {
    return "number";
  }
  if (values.length > 0 && values.every((v) => typeof v === "boolean")) {
    return "boolean";
  }
  return "string";
}

function asWeightKey(v: MemberValue): string {
  return typeof v === "boolean" ? (v ? "true" : "false") : String(v);
}

function categoricalWeights(
  values: MemberValue[],
  dimName: string,
): Record<string, number> {
  if (values.length === 0) {
    throw new ImportBridgeError(
      `No member values observed for dimension "${dimName}" — cannot derive a categorical distribution.`,
    );
  }
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = asWeightKey(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const weights: Record<string, number> = {};
  for (const key of [...counts.keys()].sort()) {
    weights[key] = counts.get(key)! / values.length;
  }
  return weights;
}

function numericDistribution(
  values: MemberValue[],
  dimName: string,
): Distribution {
  const numbers = values.filter((v): v is number => typeof v === "number");
  if (numbers.length !== values.length || numbers.length === 0) {
    throw new ImportBridgeError(
      `Dimension "${dimName}" is numeric but member values are missing or non-numeric — cannot derive a distribution.`,
    );
  }
  let min = Math.min(...numbers);
  let max = Math.max(...numbers);
  if (min === max) {
    // A single observed value still needs a valid range; pad symmetrically
    // and deterministically.
    min -= 1;
    max += 1;
  }
  return {
    type: "uniform",
    min,
    max,
    ...(numbers.every((n) => Number.isInteger(n)) ? { integer: true } : {}),
  };
}

/**
 * Derive implication rules from functional co-occurrence: for a categorical
 * pair (S, T), when every member defining both maps each S value to exactly
 * one T value (and both sides actually vary), the mapping is a dependency
 * worth preserving. When both directions are functional, the declaration
 * order wins so the rule set stays acyclic and deterministic.
 */
function deriveImplicationRules(
  dims: BridgeDimensionDef[],
  members: Entity[],
): BridgeRuleDef[] {
  const categorical = dims.filter((d) =>
    ["enum", "string", "boolean"].includes(d.dataType),
  );
  const rules: BridgeRuleDef[] = [];

  function functionalMapping(
    src: BridgeDimensionDef,
    tgt: BridgeDimensionDef,
  ): Map<string, MemberValue> | null {
    const mapping = new Map<string, MemberValue>();
    let pairs = 0;
    const srcValues = new Set<string>();
    const tgtValues = new Set<string>();
    for (const m of members) {
      const sv = (m.attributes ?? {})[src.name];
      const tv = (m.attributes ?? {})[tgt.name];
      if (!isPlainValue(sv) || !isPlainValue(tv)) continue;
      pairs += 1;
      const key = asWeightKey(sv);
      srcValues.add(key);
      tgtValues.add(asWeightKey(tv));
      const existing = mapping.get(key);
      if (existing !== undefined && asWeightKey(existing) !== asWeightKey(tv)) {
        return null; // not functional
      }
      mapping.set(key, tv);
    }
    if (pairs < 2 || srcValues.size < 2 || tgtValues.size < 2) return null;
    return mapping;
  }

  for (let i = 0; i < categorical.length; i++) {
    for (let j = i + 1; j < categorical.length; j++) {
      const a = categorical[i]!;
      const b = categorical[j]!;
      const forward = functionalMapping(a, b);
      const picked = forward
        ? { src: a, tgt: b, mapping: forward }
        : (() => {
            const backward = functionalMapping(b, a);
            return backward ? { src: b, tgt: a, mapping: backward } : null;
          })();
      if (!picked) continue;
      for (const [srcKey, tgtValue] of [...picked.mapping.entries()].sort(
        ([x], [y]) => x.localeCompare(y),
      )) {
        const equals: string | number | boolean =
          picked.src.dataType === "boolean" ? srcKey === "true" : srcKey;
        const value: string | number | boolean =
          picked.tgt.dataType === "boolean"
            ? asWeightKey(tgtValue) === "true"
            : asWeightKey(tgtValue);
        rules.push({
          sourceDimension: picked.src.name,
          targetDimension: picked.tgt.name,
          type: "implication",
          conditions: [{ equals }],
          effect: { value },
        });
      }
    }
  }
  return rules;
}

/**
 * Pure derivation: canonical graph (as committed by the MatrAIx importer)
 * → population plans. Throws ImportBridgeError on anything that cannot be
 * derived soundly.
 */
export function deriveBridgePlans(
  graph: Pick<GraphPayload, "entities" | "relationships">,
): BridgePopulationPlan[] {
  const populations = graph.entities.filter(
    (e) =>
      e.kind === "population" &&
      typeof (e.attributes ?? {})["matraixId"] === "string",
  );
  if (populations.length === 0) {
    throw new ImportBridgeError(
      "The graph contains no MatrAIx population entities — nothing to bridge.",
    );
  }

  const entitiesById = new Map(graph.entities.map((e) => [e.id, e]));

  return populations.map((pop) => {
    const attrs = pop.attributes ?? {};
    const rawDims = attrs["dimensions"];
    if (!Array.isArray(rawDims) || rawDims.length === 0) {
      throw new ImportBridgeError(
        `MatrAIx population "${String(attrs["matraixId"])}" declares no dimensions — a Population cannot be derived without them.`,
      );
    }

    const members = (graph.relationships as Relationship[])
      .filter((r) => r.type === "memberOf" && r.target === pop.id)
      .map((r) => entitiesById.get(r.source))
      .filter((e): e is Entity => Boolean(e && e.kind === "character"));
    if (members.length === 0) {
      throw new ImportBridgeError(
        `MatrAIx population "${String(attrs["matraixId"])}" has no member personas — distributions cannot be derived.`,
      );
    }

    const dimensions: BridgeDimensionDef[] = [];
    const distributions: Record<string, Distribution> = {};
    for (const raw of rawDims as RawDimension[]) {
      if (!raw || typeof raw.name !== "string" || !raw.name) {
        throw new ImportBridgeError(
          `Population "${String(attrs["matraixId"])}" has a dimension without a name.`,
        );
      }
      if (typeof raw.category !== "string" || !raw.category) {
        throw new ImportBridgeError(
          `Dimension "${raw.name}" has no category — the registry requires one.`,
        );
      }
      const values = memberValues(members, raw.name);
      const dataType = raw.dataType ?? inferDataType(values);

      let allowedValues: string[] | null = null;
      if (dataType === "enum") {
        const declared = raw.allowedValues?.map(String);
        allowedValues =
          declared && declared.length > 0
            ? declared
            : [...new Set(values.map(asWeightKey))].sort();
        if (allowedValues.length < 2) {
          throw new ImportBridgeError(
            `Enum dimension "${raw.name}" needs at least 2 allowed values (declared or observed).`,
          );
        }
        const bad = values.map(asWeightKey).find((v) => !allowedValues!.includes(v));
        if (bad !== undefined) {
          throw new ImportBridgeError(
            `Member value "${bad}" for enum dimension "${raw.name}" is not in its allowed values.`,
          );
        }
      }

      const def: BridgeDimensionDef = {
        name: raw.name,
        category: raw.category,
        dataType,
        allowedValues,
        description: `Imported from MatrAIx dimension "${raw.id ?? raw.name}".`,
      };
      // Registry invariants are enforced up-front so failures point at the
      // MatrAIx dimension, not at a later registration step.
      validateDimensionDefinition(def);
      dimensions.push(def);

      distributions[raw.name] =
        dataType === "number"
          ? numericDistribution(values, raw.name)
          : dataType === "array"
            ? (() => {
                throw new ImportBridgeError(
                  `Array dimension "${raw.name}" is not samplable — it cannot be bridged.`,
                );
              })()
            : { type: "categorical", weights: categoricalWeights(values, raw.name) };
    }

    if (new Set(dimensions.map((d) => d.name)).size !== dimensions.length) {
      throw new ImportBridgeError(
        `Population "${String(attrs["matraixId"])}" declares duplicate dimension names.`,
      );
    }

    return {
      matraixId: String(attrs["matraixId"]),
      entityId: pop.id,
      name: pop.name,
      dimensions,
      distributions,
      rules: deriveImplicationRules(dimensions, members),
      memberCount: members.length,
    };
  });
}

export interface BridgeResult {
  population: Population;
  rules: DependencyRule[];
  plan: BridgePopulationPlan;
}

/**
 * Bridge a committed MatrAIx import (content graph) into Population domain
 * rows: register dimensions, create the population with derived
 * distributions, and create derived dependency rules — all with provenance
 * referencing the import (importId/contentVersion/sourceUri/matraixId).
 */
export async function bridgeImportToPopulations(input: {
  contentId: string;
}): Promise<BridgeResult[]> {
  const row = await contentRepo.getContent(input.contentId);
  if (!row) {
    throw new ImportBridgeError(`Content "${input.contentId}" not found.`);
  }
  const content = toContentGraph(row);
  const graphProvenance = content.provenance as
    | { sourceType?: string | null; sourceUri?: string | null }
    | undefined;
  if (graphProvenance?.sourceType !== "matraix") {
    throw new ImportBridgeError(
      `Content "${input.contentId}" is not a MatrAIx import (sourceType "${String(graphProvenance?.sourceType)}").`,
    );
  }

  const plans = deriveBridgePlans(content);
  const results: BridgeResult[] = [];
  for (const plan of plans) {
    // Idempotent registration: an already-registered dimension (same name)
    // is kept as-is; incompatible definitions fail loudly in population
    // validation below — never silently overwritten.
    for (const dim of plan.dimensions) {
      await dimensionRepo.insertDimensionIfAbsent({
        id: newId("dimension"),
        name: dim.name,
        category: dim.category,
        dataType: dim.dataType,
        allowedValues: dim.allowedValues,
        source: "matraix",
        version: 1,
        description: dim.description,
      });
    }

    const provenance: PopulationProvenance = {
      operation: "import-bridge",
      createdAt: new Date().toISOString(),
      sourceType: "matraix",
      importId: content.id,
      contentVersion: content.version,
      sourceUri: graphProvenance.sourceUri ?? null,
      sourceDataset: content.title,
      matraixId: plan.matraixId,
    };

    const population = await populationService.createPopulation({
      name: plan.name,
      domain: "matraix",
      dimensions: plan.dimensions.map((d) => d.name),
      distributions: plan.distributions,
      provenance,
    });

    const rules: DependencyRule[] = [];
    for (const rule of plan.rules) {
      rules.push(
        await populationService.createDependencyRule({
          populationId: population.id,
          sourceDimension: rule.sourceDimension,
          targetDimension: rule.targetDimension,
          type: rule.type,
          conditions: rule.conditions,
          effect: rule.effect,
          provenance,
        }),
      );
    }

    // Close the create/delete race: deleteContent guards on committed
    // population provenance under an advisory lock; re-verify (under the
    // same lock) that the content survived while we were inserting. If a
    // concurrent delete won, compensate and fail loudly.
    const stillExists = await db.transaction(async (tx) => {
      await tx.execute(contentRepo.lineageLockSql(content.id));
      const [found] = await tx
        .select({ id: contentsTable.id })
        .from(contentsTable)
        .where(eq(contentsTable.id, content.id))
        .limit(1);
      return Boolean(found);
    });
    if (!stillExists) {
      await populationService.deletePopulation(population.id).catch(() => {});
      throw new ImportBridgeError(
        `Content "${content.id}" was deleted while bridging; bridge rolled back.`,
      );
    }

    results.push({ population, rules, plan });
  }
  return results;
}
