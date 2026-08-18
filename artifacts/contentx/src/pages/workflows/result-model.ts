/**
 * Maps a projection step's result payload onto the result-first view model.
 * Kept as a pure module so the contract mapping (novel: scenes[heading/prose],
 * roleplayx: context/objectives/personas/recommendedFlow) is unit-testable.
 */

export interface NovelResultView {
  kind: "novel";
  title: string;
  subtitle: string | null;
  characters: { name: string; arc: string | null }[];
  scenes: { heading: string; prose: string }[];
}

export interface RoleplayResultView {
  kind: "roleplay";
  title: string;
  context: string;
  playerRole: string | null;
  objectives: string[];
  personas: {
    name: string;
    role: string;
    background: string | null;
    traits: string[];
  }[];
  recommendedFlow: string[];
}

export type NarrativeResultView = NovelResultView | RoleplayResultView;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function getNarrativeResult(payload: unknown): NarrativeResultView | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, any>;

  if (Array.isArray(p.scenes)) {
    return {
      kind: "novel",
      title: str(p.title) ?? "무제",
      subtitle: str(p.logline) ?? str(p.theme),
      characters: Array.isArray(p.characters)
        ? p.characters
            .filter((c: any) => c && typeof c === "object" && str(c.name))
            .map((c: any) => ({ name: c.name, arc: str(c.arc) }))
        : [],
      scenes: p.scenes
        .filter((s: any) => s && typeof s === "object")
        .map((s: any, i: number) => ({
          heading: str(s.heading) ?? str(s.title) ?? `장면 ${i + 1}`,
          prose: str(s.prose) ?? str(s.summary) ?? str(s.description) ?? "",
        })),
    };
  }

  if (str(p.context)) {
    return {
      kind: "roleplay",
      title: str(p.title) ?? "무제",
      context: p.context,
      playerRole: str(p.playerRole),
      objectives: strArray(p.objectives),
      personas: Array.isArray(p.personas)
        ? p.personas
            .filter((x: any) => x && typeof x === "object" && str(x.name))
            .map((x: any) => ({
              name: x.name,
              role: str(x.role) ?? "",
              background: str(x.background),
              traits: strArray(x.traits),
            }))
        : [],
      recommendedFlow: strArray(p.recommendedFlow),
    };
  }

  return null;
}
