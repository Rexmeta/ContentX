import * as repo from "./repository";
import { SYNTHESIZER_ID } from "./synthesizer";
import { BRIDGE_SYNTHESIZER_ID } from "./bridge";
import {
  SCENARIO_ELEMENTS,
  type BridgeRole,
  type Lineage,
  type ScenarioElement,
} from "../../shared/lineage";

/** Thrown when client-provided lineage fails server-side invariants (→ 400). */
export class InvalidLineageError extends Error {}

const VALID_ELEMENTS: ReadonlySet<string> = new Set(SCENARIO_ELEMENTS);

const MAX_INSTRUCTION_LENGTH = 500;

const MAX_REQUIREMENTS = 20;
const MAX_REQUIREMENT_LENGTH = 500;

export interface LineageInput {
  kind?: string | null;
  parents: {
    scenarioId: string;
    elements: string[];
    role?: string | null;
  }[];
  instruction?: string | null;
  requirements?: string[] | null;
}

function validatedInstruction(value: string | null | undefined): string | null {
  const instruction = value?.trim() || null;
  if (instruction && instruction.length > MAX_INSTRUCTION_LENGTH) {
    throw new InvalidLineageError(
      `Instruction must be at most ${MAX_INSTRUCTION_LENGTH} characters.`,
    );
  }
  return instruction;
}

async function existingRows(ids: string[]) {
  const rows = await Promise.all(ids.map((id) => repo.getScenario(id)));
  const missing = ids.filter((_, i) => !rows[i]);
  if (missing.length > 0) {
    throw new InvalidLineageError(
      `Unknown lineage parents: ${missing.join(", ")}`,
    );
  }
  return rows;
}

/**
 * Server-authoritative lineage validation. Two kinds:
 *
 * - synthesis (default): >= 2 unique existing parents, each borrowing >= 1
 *   valid element.
 * - bridge: exactly 2 unique existing parents with roles source + target,
 *   plus validated transition requirements.
 *
 * Parent titles and the synthesizer identity are always set by the server —
 * client values for those fields are ignored, so SYNTHESIZED/BRIDGE
 * provenance cannot be forged or spoofed.
 */
export async function validateLineage(input: LineageInput): Promise<Lineage> {
  if (input.kind === "bridge") return validateBridgeLineage(input);
  if (input.kind && input.kind !== "synthesis") {
    throw new InvalidLineageError(`Unknown lineage kind: ${input.kind}`);
  }

  if (input.parents.length < 2) {
    throw new InvalidLineageError(
      "Lineage requires at least 2 parent scenarios.",
    );
  }
  const ids = input.parents.map((p) => p.scenarioId);
  if (new Set(ids).size !== ids.length) {
    throw new InvalidLineageError("Lineage parents must be unique.");
  }
  for (const parent of input.parents) {
    if (parent.elements.length === 0) {
      throw new InvalidLineageError(
        `Parent ${parent.scenarioId} must borrow at least one element.`,
      );
    }
    for (const el of parent.elements) {
      if (!VALID_ELEMENTS.has(el)) {
        throw new InvalidLineageError(`Unknown scenario element: ${el}`);
      }
    }
  }
  const instruction = validatedInstruction(input.instruction);
  const rows = await existingRows(ids);

  return {
    parents: input.parents.map((p, i) => ({
      scenarioId: p.scenarioId,
      title: rows[i]!.title,
      elements: p.elements as ScenarioElement[],
    })),
    instruction,
    synthesizedBy: SYNTHESIZER_ID,
  };
}

/**
 * Validate transition requirements for a bridge (shared by the bridge route
 * and save-time lineage validation).
 */
export function validateBridgeRequirements(
  requirements: string[] | null | undefined,
): string[] {
  const cleaned = (requirements ?? []).map((r) => r.trim()).filter(Boolean);
  if (cleaned.length > MAX_REQUIREMENTS) {
    throw new InvalidLineageError(
      `At most ${MAX_REQUIREMENTS} transition requirements are allowed.`,
    );
  }
  for (const r of cleaned) {
    if (r.length > MAX_REQUIREMENT_LENGTH) {
      throw new InvalidLineageError(
        `Each transition requirement must be at most ${MAX_REQUIREMENT_LENGTH} characters.`,
      );
    }
  }
  return cleaned;
}

async function validateBridgeLineage(input: LineageInput): Promise<Lineage> {
  if (input.parents.length !== 2) {
    throw new InvalidLineageError(
      "Bridge lineage requires exactly 2 parents (source and target).",
    );
  }
  const source = input.parents.find((p) => p.role === "source");
  const target = input.parents.find((p) => p.role === "target");
  if (!source || !target) {
    throw new InvalidLineageError(
      "Bridge lineage requires one source parent and one target parent.",
    );
  }
  if (source.scenarioId === target.scenarioId) {
    throw new InvalidLineageError(
      "Bridge source and target must be different scenarios.",
    );
  }
  const instruction = validatedInstruction(input.instruction);
  const requirements = validateBridgeRequirements(input.requirements);
  const ordered = [source, target];
  const rows = await existingRows(ordered.map((p) => p.scenarioId));

  return {
    kind: "bridge",
    parents: ordered.map((p, i) => ({
      scenarioId: p.scenarioId,
      title: rows[i]!.title,
      elements: [],
      role: p.role as BridgeRole,
    })),
    instruction,
    requirements,
    synthesizedBy: BRIDGE_SYNTHESIZER_ID,
  };
}
