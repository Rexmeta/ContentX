import type { ContentGraph, Entity } from "../content/model";
import type { CharacterSnapshot } from "../character/snapshotModel";
import type { InteractionEvent } from "../simulation/model";
import type { Evaluation } from "../evaluation/model";
import {
  buildProvenanceChain,
  InvalidProjectionError,
  type ProjectionAdapter,
  type ProjectionResult,
  type ProjectionSource,
} from "./contract";

/**
 * BusinessAdapter — projects canonical data and/or simulation results into a
 * business-scenario case study (negotiation case study / training scenario).
 * Business-specific concepts (background, stakeholders, decisionPoints,
 * outcomeAnalysis, discussionQuestions) live ONLY here; they never flow back
 * into the canonical model.
 *
 * Deterministic (no LLM): the case study is assembled directly from the
 * content graph, simulation trace, snapshots, and evaluations, so
 * modelVersion in provenance is always null.
 *
 * Sources (at least one required, like roleplayx):
 * - canonical graph → background context, stakeholders from characters,
 *   learning objectives from goals/conflicts
 * - simulation bundle → stakeholders enriched with behavioral profiles,
 *   decision points from the interaction trace, outcome analysis from the
 *   simulation outcome + evaluations
 */

export const BUSINESS_ADAPTER_VERSION = "1.0.0";

export interface BusinessStakeholder {
  id: string;
  name: string;
  role: string;
  interests: string[];
  profile: string[];
}

export interface BusinessDecisionPoint {
  sequence: number;
  turn: number;
  actor: string;
  description: string;
}

export interface BusinessOutcomeAnalysis {
  resolution: string;
  agreementReached: boolean | null;
  turnsUsed: number | null;
  evaluationFindings: string[];
}

export interface BusinessCaseStudy {
  title: string;
  background: string;
  stakeholders: BusinessStakeholder[];
  decisionPoints: BusinessDecisionPoint[];
  outcomeAnalysis: BusinessOutcomeAnalysis | null;
  learningObjectives: string[];
  discussionQuestions: string[];
}

function byKind(graph: ContentGraph, kind: string): Entity[] {
  return graph.entities.filter((e) => e.kind === kind);
}

function snapshotProfile(snapshot: CharacterSnapshot): string[] {
  const profile = snapshot.behavioralProfile;
  const lines: string[] = [];
  for (const group of ["psychological", "behavioral"] as const) {
    const values = (profile as unknown as Record<string, unknown>)[group];
    if (values && typeof values === "object") {
      for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
        if (typeof v === "string" || typeof v === "number") {
          lines.push(`${k}: ${String(v)}`);
        }
      }
    }
  }
  return lines;
}

function traceDecisionPoints(trace: InteractionEvent[]): BusinessDecisionPoint[] {
  const points: BusinessDecisionPoint[] = [];
  for (const event of trace) {
    if (event.type === "utterance") {
      const text = event.payload["text"];
      if (typeof text === "string") {
        points.push({
          sequence: event.sequence,
          turn: event.turn,
          actor: event.actorId,
          description: `Position stated: "${text}"`,
        });
      }
    } else if (event.type === "decision" || event.type === "action") {
      const action = event.payload["action"] ?? event.payload["type"];
      points.push({
        sequence: event.sequence,
        turn: event.turn,
        actor: event.actorId,
        description:
          typeof action === "string"
            ? `Decision: ${action}`
            : `Decision made (${event.type})`,
      });
    }
  }
  return points;
}

function evaluationFindings(evaluations: Evaluation[]): string[] {
  const findings: string[] = [];
  for (const evaluation of evaluations) {
    const parts: string[] = [`[${evaluation.kind}] subject ${evaluation.subjectId}`];
    const scores = evaluation.scores as Record<string, unknown> | null;
    if (scores && typeof scores === "object") {
      const scoreLines = Object.entries(scores)
        .filter(([, v]) => typeof v === "number" || typeof v === "string")
        .map(([k, v]) => `${k}=${String(v)}`);
      if (scoreLines.length > 0) parts.push(scoreLines.join(", "));
    }
    findings.push(parts.join(" — "));
  }
  return findings;
}

export const businessAdapter: ProjectionAdapter = {
  target: "business",
  version: BUSINESS_ADAPTER_VERSION,
  async project(source: ProjectionSource): Promise<ProjectionResult> {
    if (!source.graph && !source.simulation) {
      throw new InvalidProjectionError(
        "Business projection requires a content graph and/or a simulation",
      );
    }

    let title = "";
    const backgroundParts: string[] = [];
    const stakeholders: BusinessStakeholder[] = [];
    const decisionPoints: BusinessDecisionPoint[] = [];
    let outcomeAnalysis: BusinessOutcomeAnalysis | null = null;
    const learningObjectives: string[] = [];
    const discussionQuestions: string[] = [];

    if (source.graph) {
      const graph = source.graph;
      title = graph.title;

      backgroundParts.push(
        ...byKind(graph, "world").map(
          (w) => `${w.name}${w.description ? ` — ${w.description}` : ""}`,
        ),
        ...byKind(graph, "conflict").map(
          (c) => `${c.name}${c.description ? ` — ${c.description}` : ""}`,
        ),
      );

      for (const c of byKind(graph, "character")) {
        const attrs = c.attributes ?? {};
        stakeholders.push({
          id: c.id,
          name: c.name,
          role:
            typeof attrs["role"] === "string"
              ? (attrs["role"] as string)
              : c.kind,
          interests: byKind(graph, "goal")
            .filter((g) =>
              graph.relationships.some(
                (r) => r.source === c.id && r.target === g.id,
              ),
            )
            .map((g) => g.name),
          profile: Object.entries(attrs)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => `${k}: ${String(v)}`),
        });
      }

      learningObjectives.push(
        ...byKind(graph, "goal").map(
          (g) =>
            `Understand the stakes behind "${g.name}"${g.description ? `: ${g.description}` : ""}`,
        ),
      );
      discussionQuestions.push(
        ...byKind(graph, "conflict").map(
          (c) =>
            `How could the parties in "${c.name}" have reached a better outcome?`,
        ),
      );
    }

    if (source.simulation) {
      const { simulation, trace, snapshots, evaluations } = source.simulation;
      const snapshotById = new Map(snapshots.map((s) => [s.id, s]));

      if (!title) title = simulation.name;
      backgroundParts.push(
        `A ${simulation.environmentType} negotiation on "${simulation.config.topic}" between ${simulation.participants.map((p) => `${p.name} (${p.role})`).join(" and ")}, limited to ${simulation.config.maxTurns} turns.`,
      );

      for (const p of simulation.participants) {
        const existing = stakeholders.find((s) => s.id === p.characterId);
        const snapshot = snapshotById.get(p.snapshotId);
        const profile = snapshot ? snapshotProfile(snapshot) : [];
        if (existing) {
          existing.profile.push(...profile);
          continue;
        }
        stakeholders.push({
          id: p.characterId,
          name: p.name,
          role: p.role,
          interests: [
            `Secure a favorable resolution on "${simulation.config.topic}"`,
          ],
          profile,
        });
      }

      decisionPoints.push(...traceDecisionPoints(trace));

      const outcome = simulation.outcome;
      outcomeAnalysis = {
        resolution: outcome?.summary ?? "No recorded resolution.",
        agreementReached: outcome ? outcome.agreementReached : null,
        turnsUsed: outcome ? outcome.turnsUsed : null,
        evaluationFindings: evaluationFindings(evaluations),
      };

      learningObjectives.push(
        `Analyze how negotiation behavior over ${simulation.config.maxTurns} turn(s) shaped the outcome on "${simulation.config.topic}".`,
      );
      discussionQuestions.push(
        outcome?.agreementReached
          ? `The parties reached agreement in ${outcome.turnsUsed} turn(s). Which decision point was pivotal, and why?`
          : `The parties failed to reach agreement. At which decision point did the negotiation break down?`,
      );
    }

    const caseStudy: BusinessCaseStudy = {
      title,
      background: backgroundParts.join(" "),
      stakeholders,
      decisionPoints,
      outcomeAnalysis,
      learningObjectives,
      discussionQuestions,
    };

    return {
      target: "business",
      payload: caseStudy as unknown as Record<string, unknown>,
      provenance: buildProvenanceChain(source, {
        adapter: "business",
        adapterVersion: BUSINESS_ADAPTER_VERSION,
        modelVersion: null,
      }),
    };
  },
};
