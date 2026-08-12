import { newId } from "../../shared/id";
import type { Entity, Relationship } from "../content/model";
import type { DramaticScenario } from "./scenarioAmplifier";

/**
 * Builds a canonical Content Graph from a user-confirmed dramatic scenario.
 * Deterministic and pure apart from stable-ID generation: every scenario
 * element maps to a canonical entity, and structure (acts → events,
 * characters → goals/conflict) is expressed through explicit relationships.
 */
export function buildGraphFromScenario(scenario: DramaticScenario): {
  entities: Entity[];
  relationships: Relationship[];
} {
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];

  const worldId = newId("entity");
  entities.push({
    id: worldId,
    kind: "world",
    name: scenario.title,
    description: scenario.synopsis,
    attributes: { theme: scenario.theme, logline: scenario.logline },
  });

  const themeId = newId("entity");
  entities.push({
    id: themeId,
    kind: "theme",
    name: scenario.theme,
    description: scenario.logline,
    attributes: {},
  });

  const conflictId = newId("entity");
  entities.push({
    id: conflictId,
    kind: "conflict",
    name: "중심 갈등",
    description: scenario.stakes,
    attributes: { twist: scenario.twist },
  });
  relationships.push({
    id: newId("relationship"),
    source: conflictId,
    type: "expresses",
    target: themeId,
    attributes: {},
  });

  const characterIds: string[] = [];
  for (const c of scenario.characters) {
    const charId = newId("entity");
    characterIds.push(charId);
    entities.push({
      id: charId,
      kind: "character",
      name: c.name,
      description: c.motivation,
      attributes: { role: c.role },
    });

    const goalId = newId("entity");
    entities.push({
      id: goalId,
      kind: "goal",
      name: `${c.name}의 목표`,
      description: c.motivation,
      attributes: {},
    });
    relationships.push({
      id: newId("relationship"),
      source: charId,
      type: "wants",
      target: goalId,
      attributes: {},
    });
    relationships.push({
      id: newId("relationship"),
      source: conflictId,
      type: "involves",
      target: charId,
      attributes: {},
    });
    relationships.push({
      id: newId("relationship"),
      source: charId,
      type: "lives_in",
      target: worldId,
      attributes: {},
    });
  }

  // Protagonist/antagonist opposition when both exist.
  const roles = scenario.characters.map((c) => c.role.toLowerCase());
  const protagonistIdx = roles.findIndex((r) => r.includes("protagonist") || r.includes("리더") || r.includes("주인공"));
  const antagonistIdx = roles.findIndex(
    (r, i) => i !== protagonistIdx && (r.includes("antagonist") || r.includes("리더") || r.includes("대립")),
  );
  if (protagonistIdx >= 0 && antagonistIdx >= 0) {
    relationships.push({
      id: newId("relationship"),
      source: characterIds[protagonistIdx]!,
      type: "conflicts_with",
      target: characterIds[antagonistIdx]!,
      attributes: { stakes: scenario.stakes },
    });
  }

  let previousActEventId: string | null = null;
  for (const [i, act] of scenario.acts.entries()) {
    const actId = newId("entity");
    entities.push({
      id: actId,
      kind: "event",
      name: act.name,
      description: act.summary,
      attributes: { order: i + 1, beats: act.beats },
    });
    relationships.push({
      id: newId("relationship"),
      source: actId,
      type: "occurs_in",
      target: worldId,
      attributes: {},
    });
    relationships.push({
      id: newId("relationship"),
      source: actId,
      type: "advances",
      target: conflictId,
      attributes: {},
    });
    if (previousActEventId) {
      relationships.push({
        id: newId("relationship"),
        source: previousActEventId,
        type: "precedes",
        target: actId,
        attributes: {},
      });
    }
    previousActEventId = actId;
  }

  // Twist as an outcome-shaping narrative element.
  const twistId = newId("entity");
  entities.push({
    id: twistId,
    kind: "narrative",
    name: "반전",
    description: scenario.twist,
    attributes: {},
  });
  relationships.push({
    id: newId("relationship"),
    source: twistId,
    type: "transforms",
    target: conflictId,
    attributes: {},
  });

  return { entities, relationships };
}
