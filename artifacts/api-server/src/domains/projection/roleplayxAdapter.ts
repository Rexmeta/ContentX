import type { ContentGraph, Entity } from "../content/model";

/**
 * RoleplayXAdapter — explicit projection from the canonical Content Graph to
 * RoleplayX Scenario JSON. RoleplayX-specific concepts (context, playerRole,
 * objectives, successCriteria, personas, recommendedFlow) live ONLY here;
 * they never flow back into the canonical model.
 *
 * Mapping documented in docs/projections/roleplayx.md.
 */

export interface RoleplayXPersona {
  id: string;
  name: string;
  role: string;
  background?: string | null;
  traits: string[];
}

export interface RoleplayXScenario {
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
    .map((r) => `${names.get(r.source) ?? r.source} ${r.type} ${names.get(r.target) ?? r.target}`);
}

export function projectToRoleplayX(graph: ContentGraph): RoleplayXScenario {
  const worlds = byKind(graph, "world");
  const narratives = byKind(graph, "narrative");
  const characters = byKind(graph, "character");
  const goals = byKind(graph, "goal");
  const outcomes = byKind(graph, "outcome");
  const conflicts = byKind(graph, "conflict");
  const events = byKind(graph, "event");

  const contextParts = [
    ...worlds.map((w) => `${w.name}${w.description ? ` — ${w.description}` : ""}`),
    ...conflicts.map((c) => `${c.name}${c.description ? ` — ${c.description}` : ""}`),
  ];

  const playerRole =
    characters.length > 0
      ? `You play as ${characters[0]!.name}${characters[0]!.description ? ` (${characters[0]!.description})` : ""}.`
      : "You play as an involved observer of the scenario.";

  const personas: RoleplayXPersona[] = characters.map((c) => {
    const attrs = c.attributes ?? {};
    const traits = Object.entries(attrs)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => `${k}: ${String(v)}`);
    return {
      id: c.id,
      name: c.name,
      role: typeof attrs["role"] === "string" ? (attrs["role"] as string) : c.kind,
      background: c.description ?? null,
      traits,
    };
  });

  const objectives = goals.map(
    (g) => `${g.name}${g.description ? `: ${g.description}` : ""}`,
  );

  const successCriteria =
    outcomes.length > 0
      ? outcomes.map((o) => `${o.name}${o.description ? `: ${o.description}` : ""}`)
      : conflicts.map((c) => `Resolve "${c.name}" in a way both sides can accept.`);

  const recommendedFlow = [
    ...events.map(
      (e) => `${e.name}${e.description ? ` — ${e.description}` : ""}`,
    ),
    ...conflicts.flatMap((c) => relationLine(graph, c.id, "involves")),
  ];

  return {
    title: graph.title,
    context: contextParts.join(" "),
    playerRole,
    objectives,
    successCriteria,
    personas,
    recommendedFlow,
    meta: {
      sourceContentId: graph.id,
      sourceVersion: graph.version,
      projectedAt: new Date().toISOString(),
      adapter: "roleplayx@1",
    },
  };
}
