import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  populationsTable,
  dependencyRulesTable,
  samplingRunsTable,
  charactersTable,
  characterSnapshotsTable,
  populationVersionsTable,
  dependencyGraphVersionsTable,
  type PopulationRow,
  type DependencyRuleRow,
  type SamplingRunRow,
  type PopulationVersionRow,
  type DependencyGraphVersionRow,
  type InsertPopulation,
  type InsertDependencyRule,
  type InsertSamplingRun,
  type InsertCharacter,
} from "@workspace/db";
import { newId } from "../../shared/id";
import {
  dependencyGraphVersion,
  graphRulesSnapshot,
  populationDefinitionSnapshot,
} from "./versioning";

export async function listPopulations(): Promise<PopulationRow[]> {
  return db
    .select()
    .from(populationsTable)
    .orderBy(desc(populationsTable.updatedAt));
}

export async function getPopulation(
  id: string,
): Promise<PopulationRow | undefined> {
  const [row] = await db
    .select()
    .from(populationsTable)
    .where(eq(populationsTable.id, id));
  return row;
}

/**
 * Insert a population AND its version-1 definition snapshot atomically, so
 * every version that ever existed is resolvable from population_versions.
 */
export async function insertPopulation(
  row: InsertPopulation,
): Promise<PopulationRow> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(populationsTable)
      .values(row)
      .returning();
    if (!inserted) throw new Error("Failed to insert population");
    await tx.insert(populationVersionsTable).values({
      id: newId("populationversion"),
      populationId: inserted.id,
      version: inserted.version,
      definition: populationDefinitionSnapshot(inserted),
    });
    return inserted;
  });
}

/**
 * Serialized versioned update: locks the population row, lets the caller
 * validate the patch against the current definition + rule set inside the
 * transaction, bumps version, and snapshots the NEW definition into
 * population_versions — old versions remain untouched (immutable history).
 */
type PopulationPatch = Partial<
  Pick<
    InsertPopulation,
    | "name"
    | "domain"
    | "dimensions"
    | "distributions"
    | "constraints"
    | "samplingConfig"
    | "provenance"
  >
>;
export async function updatePopulationSerialized(
  id: string,
  // Builds + validates the patch FROM THE LOCKED current row (and current
  // rule set), so concurrent mutations cannot validate against stale state.
  buildPatch: (
    current: PopulationRow,
    rules: DependencyRuleRow[],
  ) => PopulationPatch,
): Promise<PopulationRow | undefined> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(populationsTable)
      .where(eq(populationsTable.id, id))
      .for("update");
    if (!current) return undefined;
    const rules = await listRulesTx(tx, id);
    const patch = buildPatch(current, rules);
    // Backfill: legacy rows (created before version history existed) have no
    // snapshot for their current version — preserve it before mutating.
    await tx
      .insert(populationVersionsTable)
      .values({
        id: newId("populationversion"),
        populationId: current.id,
        version: current.version,
        definition: populationDefinitionSnapshot(current),
      })
      .onConflictDoNothing();
    const [updated] = await tx
      .update(populationsTable)
      .set({ ...patch, version: current.version + 1 })
      .where(eq(populationsTable.id, id))
      .returning();
    if (!updated) throw new Error("Failed to update population");
    await tx
      .insert(populationVersionsTable)
      .values({
        id: newId("populationversion"),
        populationId: updated.id,
        version: updated.version,
        definition: populationDefinitionSnapshot(updated),
      })
      .onConflictDoNothing();
    return updated;
  });
}

/**
 * Thrown when a population cannot be deleted because immutable downstream
 * lineage (character snapshots, and through them agents, simulations, and
 * evaluations) still references it. Deleting would break lineage back-tracing.
 */
export class PopulationReferencedError extends Error {
  constructor(id: string, referencedBy: string) {
    super(
      `Population "${id}" cannot be deleted: it is still referenced by ${referencedBy}.`,
    );
    this.name = "PopulationReferencedError";
  }
}

export async function deletePopulation(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Row lock serializes deletion against concurrent sampling (which also
    // locks the population row before inserting its run + characters).
    const [locked] = await tx
      .select({ id: populationsTable.id })
      .from(populationsTable)
      .where(eq(populationsTable.id, id))
      .for("update");
    if (!locked) return false;

    const [run] = await tx
      .select({ id: samplingRunsTable.id })
      .from(samplingRunsTable)
      .where(eq(samplingRunsTable.populationId, id))
      .limit(1);
    if (run) {
      throw new PopulationReferencedError(id, `sampling run "${run.id}"`);
    }
    const [snapshot] = await tx
      .select({ id: characterSnapshotsTable.id })
      .from(characterSnapshotsTable)
      .where(eq(characterSnapshotsTable.populationId, id))
      .limit(1);
    if (snapshot) {
      throw new PopulationReferencedError(
        id,
        `character snapshot "${snapshot.id}"`,
      );
    }
    const [character] = await tx
      .select({ id: charactersTable.id })
      .from(charactersTable)
      .where(sql`${charactersTable.provenance}->>'populationId' = ${id}`)
      .limit(1);
    if (character) {
      throw new PopulationReferencedError(id, `character "${character.id}"`);
    }

    const deleted = await tx
      .delete(populationsTable)
      .where(eq(populationsTable.id, id))
      .returning({ id: populationsTable.id });
    return deleted.length > 0;
  });
}

async function listRulesTx(
  tx: Tx,
  populationId: string,
): Promise<DependencyRuleRow[]> {
  return tx
    .select()
    .from(dependencyRulesTable)
    .where(eq(dependencyRulesTable.populationId, populationId))
    .orderBy(asc(dependencyRulesTable.createdAt), asc(dependencyRulesTable.id));
}
export async function listRulesForPopulation(
  populationId: string,
): Promise<DependencyRuleRow[]> {
  return db
    .select()
    .from(dependencyRulesTable)
    .where(eq(dependencyRulesTable.populationId, populationId))
    .orderBy(asc(dependencyRulesTable.createdAt), asc(dependencyRulesTable.id));
}

export async function getRule(
  id: string,
): Promise<DependencyRuleRow | undefined> {
  const [row] = await db
    .select()
    .from(dependencyRulesTable)
    .where(eq(dependencyRulesTable.id, id));
  return row;
}
/**
 * Serialized rule deletion: locks the population row, deletes the rule,
 * then snapshots the resulting graph so the new digest is resolvable.
 */
export async function deleteRule(id: string): Promise<boolean> {
  const rule = await getRule(id);
  if (!rule) return false;
  return db.transaction(async (tx) => {
    await tx
      .select({ id: populationsTable.id })
      .from(populationsTable)
      .where(eq(populationsTable.id, rule.populationId))
      .for("update");
    // Preserve the PRE-mutation graph (idempotent; covers legacy rows
    // whose current digest was never snapshotted).
    await snapshotGraphTx(tx, rule.populationId);
    const deleted = await tx
      .delete(dependencyRulesTable)
      .where(eq(dependencyRulesTable.id, id))
      .returning({ id: dependencyRulesTable.id });
    if (deleted.length === 0) return false;
    await snapshotGraphTx(tx, rule.populationId);
    return true;
  });
}

/**
 * Atomic write of one sampling run: all sampled characters + the audit
 * record + the dependency-graph snapshot commit together or not at all
 * (no orphan characters, no run whose pinned graph is unresolvable).
 */
export async function insertSamplingRunWithCharacters(
  characters: InsertCharacter[],
  run: InsertSamplingRun,
): Promise<SamplingRunRow> {
  return db.transaction(async (tx) => {
    // Lock the population row so a concurrent deletePopulation cannot pass
    // its "no sampling runs" check while this run is being written.
    const [locked] = await tx
      .select({ id: populationsTable.id })
      .from(populationsTable)
      .where(eq(populationsTable.id, run.populationId))
      .for("update");
    if (!locked) {
      throw new Error(
        `Population "${run.populationId}" no longer exists; sampling run aborted.`,
      );
    }
    if (characters.length > 0) {
      await tx.insert(charactersTable).values(characters);
    }
    const [inserted] = await tx
      .insert(samplingRunsTable)
      .values(run)
      .returning();
    if (!inserted) throw new Error("Failed to insert sampling run");
    await snapshotGraphTx(tx, run.populationId);
    return inserted;
  });
}

/**
 * Serialized rule creation: locks the population row (SELECT ... FOR
 * UPDATE), re-reads the rule set inside the transaction, runs the given
 * cycle check, inserts, then snapshots the new graph digest — concurrent
 * creations cannot commit a cycle.
 */
export async function insertRuleSerialized(
  row: InsertDependencyRule,
  // Validates against the LOCKED population row + current rule set, so a
  // concurrent population update cannot invalidate the rule between the
  // caller's pre-check and this insert.
  validate: (
    population: PopulationRow,
    existing: DependencyRuleRow[],
  ) => void,
): Promise<DependencyRuleRow> {
  return db.transaction(async (tx) => {
    const [population] = await tx
      .select()
      .from(populationsTable)
      .where(eq(populationsTable.id, row.populationId))
      .for("update");
    if (!population) {
      throw new Error(`Population "${row.populationId}" not found`);
    }
    const existing = await listRulesTx(tx, row.populationId);
    validate(population, existing);
    // Preserve the PRE-mutation graph (idempotent; covers legacy rows).
    await snapshotGraphTx(tx, row.populationId);
    const [inserted] = await tx
      .insert(dependencyRulesTable)
      .values(row)
      .returning();
    if (!inserted) throw new Error("Failed to insert dependency rule");
    await snapshotGraphTx(tx, row.populationId);
    return inserted;
  });
}

/**
 * Serialized versioned rule update: locks the population row, lets the
 * caller re-validate (cycle check with the updated rule substituted),
 * bumps the rule version, and snapshots the resulting graph digest.
 */
type RulePatch = Partial<
  Pick<
    InsertDependencyRule,
    | "sourceDimension"
    | "targetDimension"
    | "type"
    | "conditions"
    | "effect"
    | "strength"
    | "provenance"
  >
>;
export async function updateRuleSerialized(
  id: string,
  // Builds + validates the patch FROM THE LOCKED population row and the
  // current rule set inside the transaction (no stale pre-read state).
  buildPatch: (
    population: PopulationRow,
    current: DependencyRuleRow,
    others: DependencyRuleRow[],
  ) => RulePatch,
): Promise<DependencyRuleRow | undefined> {
  const rule = await getRule(id);
  if (!rule) return undefined;
  return db.transaction(async (tx) => {
    const [population] = await tx
      .select()
      .from(populationsTable)
      .where(eq(populationsTable.id, rule.populationId))
      .for("update");
    if (!population) return undefined;
    const all = await listRulesTx(tx, rule.populationId);
    const current = all.find((r) => r.id === id);
    if (!current) return undefined;
    const patch = buildPatch(
      population,
      current,
      all.filter((r) => r.id !== id),
    );
    // Preserve the PRE-mutation graph (idempotent; covers legacy rows).
    await snapshotGraphTx(tx, rule.populationId);
    const [updated] = await tx
      .update(dependencyRulesTable)
      .set({ ...patch, version: current.version + 1 })
      .where(eq(dependencyRulesTable.id, id))
      .returning();
    if (!updated) throw new Error("Failed to update dependency rule");
    await snapshotGraphTx(tx, rule.populationId);
    return updated;
  });
}
export async function getSamplingRun(
  id: string,
): Promise<SamplingRunRow | undefined> {
  const [row] = await db
    .select()
    .from(samplingRunsTable)
    .where(eq(samplingRunsTable.id, id));
  return row;
}

export async function listSamplingRuns(
  populationId: string,
): Promise<SamplingRunRow[]> {
  return db
    .select()
    .from(samplingRunsTable)
    .where(eq(samplingRunsTable.populationId, populationId))
    .orderBy(desc(samplingRunsTable.createdAt));
}

/** Persistence boundary for populations, dependency rules, sampling audit. */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getGraphVersion(
  populationId: string,
  graphVersion: string,
): Promise<DependencyGraphVersionRow | undefined> {
  const [row] = await db
    .select()
    .from(dependencyGraphVersionsTable)
    .where(
      and(
        eq(dependencyGraphVersionsTable.populationId, populationId),
        eq(dependencyGraphVersionsTable.graphVersion, graphVersion),
      ),
    );
  return row;
}

export async function getPopulationVersion(
  populationId: string,
  version: number,
): Promise<PopulationVersionRow | undefined> {
  const [row] = await db
    .select()
    .from(populationVersionsTable)
    .where(
      and(
        eq(populationVersionsTable.populationId, populationId),
        eq(populationVersionsTable.version, version),
      ),
    );
  return row;
}

/**
 * Snapshot the CURRENT full rule set under its digest (idempotent — the
 * digest is content-addressed, so conflicts mean the snapshot already
 * exists and is identical).
 */
async function snapshotGraphTx(
  tx: Tx,
  populationId: string,
): Promise<void> {
  const rules = await listRulesTx(tx, populationId);
  await tx
    .insert(dependencyGraphVersionsTable)
    .values({
      id: newId("depgraph"),
      populationId,
      graphVersion: dependencyGraphVersion(rules),
      rules: graphRulesSnapshot(rules),
    })
    .onConflictDoNothing();
}

export async function listPopulationVersions(
  populationId: string,
): Promise<PopulationVersionRow[]> {
  return db
    .select()
    .from(populationVersionsTable)
    .where(eq(populationVersionsTable.populationId, populationId))
    .orderBy(asc(populationVersionsTable.version));
}
