import type { ContentGraph, Entity } from "../content/model";
import type { CharacterSnapshot } from "../character/snapshotModel";
import type { InteractionEvent } from "../simulation/model";
import {
  buildProvenanceChain,
  InvalidProjectionError,
  type ProjectionAdapter,
  type ProjectionResult,
  type ProjectionSource,
} from "./contract";

/**
 * RoleplayXAdapter v2 — explicit projection from canonical data and/or
 * simulation results to RoleplayX Scenario JSON. RoleplayX-specific concepts
 * (context, playerRole, objectives, successCriteria, personas,
 * recommendedFlow, evaluationContract) live ONLY here; they never flow back
 * into the canonical model.
 *
 * v2 accepts either or both sources:
 * - canonical graph → world/goal/conflict-driven scenario (v1 behavior)
 * - simulation bundle → actors from snapshots, environment from config,
 *   recommendedFlow from the actual interaction trace, and an evaluation
 *   contract mirroring how the run was evaluated.
 *
 * Mapping documented in docs/projections/roleplayx.md.
 */

export const ROLEPLAYX_ADAPTER_VERSION = "2.0.0";

export interface RoleplayXPersona {
  id: string;
  name: string;
  role: string;
  background?: string | null;
  traits: string[];
}

export interface RoleplayXEvaluationContract {
  kinds: string[];
  criteria: string[];
}

export interface RoleplayXScenario {
  title: string;
  context: string;
  playerRole: string;
  objectives: string[];
  successCriteria: string[];
  personas: RoleplayXPersona[];
  recommendedFlow: string[];
  environment: {
    type: string;
    topic: string | null;
    maxTurns: number | null;
  } | null;
  evaluationContract: RoleplayXEvaluationContract | null;
}

function byKind(graph: ContentGraph, kind: string): Entity[] {
  return graph.entities.filter((e) => e.kind === kind);
}

function relationLine(
  graph: ContentGraph,
  sourceId: string,
  type?: string,
): string[] {
  const names = new Map(graph.entities.map((e) => [e.id, e.name]));
  return graph.relationships
    .filter((r) => r.source === sourceId && (!type || r.type === type))
    .map(
      (r) =>
        `${names.get(r.source) ?? r.source} ${r.type} ${names.get(r.target) ?? r.target}`,
    );
}

function snapshotTraits(snapshot: CharacterSnapshot): string[] {
  const profile = snapshot.behavioralProfile;
  const traits: string[] = [];
  for (const group of ["psychological", "behavioral"] as const) {
    const values = (profile as unknown as Record<string, unknown>)[group];
    if (values && typeof values === "object") {
      for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
        if (typeof v === "string" || typeof v === "number") {
          traits.push(`${k}: ${String(v)}`);
        }
      }
    }
  }
  return traits;
}

function traceFlow(trace: InteractionEvent[]): string[] {
  // Scene beats: one line per decision/utterance pair, plus the outcome.
  const flow: string[] = [];
  for (const event of trace) {
    if (event.type === "utterance") {
      const text = event.payload["text"];
      if (typeof text === "string") {
        flow.push(`Turn ${event.turn + 1} — ${event.actorId}: "${text}"`);
      }
    } else if (event.type === "outcome") {
      const summary = event.payload["summary"];
      if (typeof summary === "string") flow.push(`Resolution — ${summary}`);
    }
  }
  return flow;
}

export const roleplayxAdapter: ProjectionAdapter = {
  target: "roleplayx",
  version: ROLEPLAYX_ADAPTER_VERSION,
  async project(source: ProjectionSource): Promise<ProjectionResult> {
    if (!source.graph && !source.simulation) {
      throw new InvalidProjectionError(
        "RoleplayX projection requires a content graph and/or a simulation",
      );
    }

    let title = "";
    let context = "";
    let playerRole = "You play as an involved observer of the scenario.";
    const objectives: string[] = [];
    const successCriteria: string[] = [];
    const personas: RoleplayXPersona[] = [];
    const recommendedFlow: string[] = [];
    let environment: RoleplayXScenario["environment"] = null;
    let evaluationContract: RoleplayXEvaluationContract | null = null;

    if (source.graph) {
      const graph = source.graph;
      title = graph.title;
      const worlds = byKind(graph, "world");
      const conflicts = byKind(graph, "conflict");
      const characters = byKind(graph, "character");

      context = [
        ...worlds.map(
          (w) => `${w.name}${w.description ? ` — ${w.description}` : ""}`,
        ),
        ...conflicts.map(
          (c) => `${c.name}${c.description ? ` — ${c.description}` : ""}`,
        ),
      ].join(" ");

      if (characters.length > 0) {
        playerRole = `You play as ${characters[0]!.name}${characters[0]!.description ? ` (${characters[0]!.description})` : ""}.`;
      }

      for (const c of characters) {
        const attrs = c.attributes ?? {};
        personas.push({
          id: c.id,
          name: c.name,
          role:
            typeof attrs["role"] === "string"
              ? (attrs["role"] as string)
              : c.kind,
          background: c.description ?? null,
          traits: Object.entries(attrs)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => `${k}: ${String(v)}`),
        });
      }

      objectives.push(
        ...byKind(graph, "goal").map(
          (g) => `${g.name}${g.description ? `: ${g.description}` : ""}`,
        ),
      );

      const outcomes = byKind(graph, "outcome");
      successCriteria.push(
        ...(outcomes.length > 0
          ? outcomes.map(
              (o) => `${o.name}${o.description ? `: ${o.description}` : ""}`,
            )
          : conflicts.map(
              (c) => `Resolve "${c.name}" in a way both sides can accept.`,
            )),
      );

      recommendedFlow.push(
        ...byKind(graph, "event").map(
          (e) => `${e.name}${e.description ? ` — ${e.description}` : ""}`,
        ),
        ...conflicts.flatMap((c) => relationLine(graph, c.id, "involves")),
      );
    }

    if (source.simulation) {
      const { simulation, trace, snapshots, evaluations } = source.simulation;
      const snapshotById = new Map(snapshots.map((s) => [s.id, s]));

      if (!title) title = simulation.name;
      if (!context) {
        context = `A ${simulation.environmentType} negotiation on "${simulation.config.topic}" between ${simulation.participants.map((p) => p.name).join(" and ")}.`;
      }

      const first = simulation.participants[0];
      if (personas.length === 0 && first) {
        playerRole = `You play as ${first.name} (${first.role}).`;
      }

      for (const p of simulation.participants) {
        if (personas.some((persona) => persona.id === p.characterId)) continue;
        const snapshot = snapshotById.get(p.snapshotId);
        personas.push({
          id: p.characterId,
          name: p.name,
          role: p.role,
          background: null,
          traits: snapshot ? snapshotTraits(snapshot) : [],
        });
      }

      objectives.push(
        `Reach an agreement on "${simulation.config.topic}" within ${simulation.config.maxTurns} turns.`,
      );
      if (simulation.outcome) {
        successCriteria.push(
          simulation.outcome.agreementReached
            ? `Match or beat the reference run: agreement within ${simulation.outcome.turnsUsed} turn(s).`
            : `Reach the agreement the reference run failed to reach in ${simulation.outcome.turnsUsed} turn(s).`,
        );
      }

      recommendedFlow.push(...traceFlow(trace));

      environment = {
        type: simulation.environmentType,
        topic: simulation.config.topic,
        maxTurns: simulation.config.maxTurns,
      };

      const kinds = [...new Set(evaluations.map((e) => e.kind))];
      evaluationContract = {
        kinds:
          kinds.length > 0
            ? kinds
            : ["behavior", "personaFidelity", "outcome"],
        criteria: [
          "Behavior: stay active every turn; cooperative moves (concede/accept) are scored.",
          "Persona fidelity: concession behavior must match the persona's risk tolerance.",
          "Outcome: agreement reached, turn efficiency, and final position convergence.",
        ],
      };
    }

    const scenario: RoleplayXScenario = {
      title,
      context,
      playerRole,
      objectives,
      successCriteria,
      personas,
      recommendedFlow,
      environment,
      evaluationContract,
    };

    return {
      target: "roleplayx",
      payload: scenario as unknown as Record<string, unknown>,
      provenance: buildProvenanceChain(source, {
        adapter: "roleplayx",
        adapterVersion: ROLEPLAYX_ADAPTER_VERSION,
        modelVersion: null,
      }),
    };
  },
};

/**
 * Legacy v1 shape kept for the existing GET /v1/projections/roleplayx/{id}
 * endpoint (graph-only, flat meta).
 */
export interface RoleplayXScenarioV1 {
  title: string;
  context: string;
  playerRole: string;
  objectives: string[];
  successCriteria: string[];
  personas: RoleplayXPersona[];
  recommendedFlow: string[];
  meta: {
    sourceContentId: string;
    sourceVersion: number;
    projectedAt: string;
    adapter: string;
  };
}

export async function projectToRoleplayX(
  graph: ContentGraph,
): Promise<RoleplayXScenarioV1> {
  const result = await roleplayxAdapter.project({ graph, simulation: null });
  const s = result.payload as unknown as RoleplayXScenario;
  return {
    title: s.title,
    context: s.context,
    playerRole: s.playerRole,
    objectives: s.objectives,
    successCriteria: s.successCriteria,
    personas: s.personas,
    recommendedFlow: s.recommendedFlow,
    meta: {
      sourceContentId: graph.id,
      sourceVersion: graph.version,
      projectedAt:
        result.provenance.find((l) => l.layer === "projection")?.layer ===
        "projection"
          ? (
              result.provenance.find((l) => l.layer === "projection") as {
                projectedAt: string;
              }
            ).projectedAt
          : new Date().toISOString(),
      adapter: `roleplayx@${ROLEPLAYX_ADAPTER_VERSION}`,
    },
  };
}
