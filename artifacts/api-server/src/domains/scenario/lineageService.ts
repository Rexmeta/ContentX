import * as repo from "./repository";
import {
  SYNTHESIZER_ID,
  type Lineage,
  type ScenarioElement,
} from "./synthesizer";

/** Thrown when client-provided lineage fails server-side invariants (→ 400). */
export class InvalidLineageError extends Error {}

const VALID_ELEMENTS: ReadonlySet<string> = new Set([
  "characters",
  "conflict",
  "setting",
  "twist",
  "structure",
]);

const MAX_INSTRUCTION_LENGTH = 500;

export interface LineageInput {
  parents: { scenarioId: string; elements: string[] }[];
  instruction?: string | null;
}

/**
 * Server-authoritative lineage validation: requires >= 2 unique existing
 * parent scenarios, each borrowing >= 1 valid element. Parent titles and the
 * synthesizer identity are always set by the server — client values for those
 * fields are ignored, so SYNTHESIZED provenance cannot be forged or spoofed.
 */
export async function validateLineage(input: LineageInput): Promise<Lineage> {
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
  const instruction = input.instruction?.trim() || null;
  if (instruction && instruction.length > MAX_INSTRUCTION_LENGTH) {
    throw new InvalidLineageError(
      `Instruction must be at most ${MAX_INSTRUCTION_LENGTH} characters.`,
    );
  }

  const rows = await Promise.all(ids.map((id) => repo.getScenario(id)));
  const missing = ids.filter((_, i) => !rows[i]);
  if (missing.length > 0) {
    throw new InvalidLineageError(
      `Unknown lineage parents: ${missing.join(", ")}`,
    );
  }

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
