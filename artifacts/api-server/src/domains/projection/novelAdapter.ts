import { z } from "zod";
import {
  completeJSON,
  LLM_MODEL_ID,
  LLMRequestError,
} from "../ai/llmClient";
import {
  buildProvenanceChain,
  InvalidProjectionError,
  ProjectionExecutionError,
  type ProjectionAdapter,
  type ProjectionResult,
  type ProjectionSource,
} from "./contract";

/**
 * NovelAdapter — projects the SAME canonical graph (optionally enriched by a
 * simulation trace) into a short-story draft. It reads only canonical
 * concepts (entities, relationships, descriptions) plus optional runtime
 * results; it requires NO roleplay-specific fields, proving the canonical
 * model is projection-independent.
 *
 * The story text is LLM-generated but STRICTLY schema-validated before it is
 * returned — invalid provider output is an explicit error, never silently
 * repaired.
 */

export const NOVEL_ADAPTER_VERSION = "1.0.0";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Draft contract: 2–4 scenes, each 80–200 words of prose. */
export const NOVEL_SCENE_MIN = 2;
export const NOVEL_SCENE_MAX = 4;
export const NOVEL_PROSE_MIN_WORDS = 80;
export const NOVEL_PROSE_MAX_WORDS = 200;

// STRICT: undeclared provider fields are a contract violation, and the
// declared draft constraints (scene count, prose length) are enforced —
// output violating the stated contract is a 502, never returned as success.
export const novelDraftSchema = z.strictObject({
  title: z.string().min(1),
  logline: z.string().min(1),
  theme: z.string().min(1),
  characters: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        arc: z.string().min(1),
      }),
    )
    .min(1),
  scenes: z
    .array(
      z.strictObject({
        heading: z.string().min(1),
        prose: z
          .string()
          .refine(
            (text) => {
              const words = wordCount(text);
              return (
                words >= NOVEL_PROSE_MIN_WORDS &&
                words <= NOVEL_PROSE_MAX_WORDS
              );
            },
            {
              message: `Scene prose must be ${NOVEL_PROSE_MIN_WORDS}-${NOVEL_PROSE_MAX_WORDS} words`,
            },
          ),
      }),
    )
    .min(NOVEL_SCENE_MIN)
    .max(NOVEL_SCENE_MAX),
});

export type NovelDraft = z.infer<typeof novelDraftSchema>;

function describeSource(source: ProjectionSource): string {
  const parts: string[] = [];
  if (source.graph) {
    const g = source.graph;
    parts.push(`# Canonical world: ${g.title}`);
    for (const e of g.entities) {
      parts.push(
        `- [${e.kind}] ${e.name}${e.description ? `: ${e.description}` : ""}`,
      );
    }
    const names = new Map(g.entities.map((e) => [e.id, e.name]));
    for (const r of g.relationships) {
      parts.push(
        `- ${names.get(r.source) ?? r.source} ${r.type} ${names.get(r.target) ?? r.target}`,
      );
    }
  }
  if (source.simulation) {
    const { simulation, trace } = source.simulation;
    parts.push(
      `# Simulated events (topic: ${simulation.config.topic}, participants: ${simulation.participants.map((p) => `${p.name} (${p.role})`).join(", ")})`,
    );
    for (const event of trace) {
      if (event.type === "utterance") {
        const text = event.payload["text"];
        if (typeof text === "string") {
          parts.push(`- Turn ${event.turn + 1}, ${event.actorId} says: "${text}"`);
        }
      } else if (event.type === "outcome") {
        const summary = event.payload["summary"];
        if (typeof summary === "string") parts.push(`- Ending: ${summary}`);
      }
    }
  }
  return parts.join("\n");
}

export const novelAdapter: ProjectionAdapter = {
  target: "novel",
  version: NOVEL_ADAPTER_VERSION,
  async project(source: ProjectionSource): Promise<ProjectionResult> {
    if (!source.graph && !source.simulation) {
      throw new InvalidProjectionError(
        "Novel projection requires a content graph and/or a simulation",
      );
    }

    let raw: unknown;
    try {
      raw = await completeJSON({
        system:
          "You are a fiction writer. From the given canonical world model (and optional simulated events), write a SHORT story draft. " +
          'Respond ONLY with JSON: {"title": string, "logline": string, "theme": string, ' +
          '"characters": [{"name": string, "arc": string}], "scenes": [{"heading": string, "prose": string}]}. ' +
          "Exactly 2-4 scenes; each scene's prose MUST be between 100 and 180 words (hard requirement). No fields other than those listed.",
        user: describeSource(source),
        maxCompletionTokens: 4000,
      });
    } catch (err) {
      if (err instanceof LLMRequestError) {
        throw new ProjectionExecutionError(
          `Novel projection LLM request failed: ${err.message}`,
        );
      }
      throw err;
    }

    const parsed = novelDraftSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ProjectionExecutionError(
        `Novel projection produced invalid output: ${parsed.error.message}`,
      );
    }

    return {
      target: "novel",
      payload: parsed.data as unknown as Record<string, unknown>,
      provenance: buildProvenanceChain(source, {
        adapter: "novel",
        adapterVersion: NOVEL_ADAPTER_VERSION,
        modelVersion: LLM_MODEL_ID,
      }),
    };
  },
};
