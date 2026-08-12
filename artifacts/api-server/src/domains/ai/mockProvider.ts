import { newId } from "../../shared/id";
import type { Entity, Relationship } from "../content/model";
import type { AIProvider, GenerationResult } from "./provider";

/**
 * Deterministic mock provider. Produces a structurally correct Content Graph
 * from a natural-language prompt without calling an external LLM, so the
 * pipeline (Generate → Validate → Commit) works with no API key.
 *
 * It recognizes the canonical demo prompt about a quality team and a
 * marketing team clashing before a product launch (Korean or English) and
 * otherwise falls back to a generic conflict-structure template seeded with
 * the prompt text.
 */

interface Blueprint {
  entities: Array<{
    key: string;
    kind: string;
    name: string;
    description: string;
    attributes?: Record<string, unknown>;
  }>;
  relationships: Array<{
    source: string;
    type: string;
    target: string;
    attributes?: Record<string, unknown>;
  }>;
}

function productLaunchBlueprint(prompt: string): Blueprint {
  return {
    entities: [
      {
        key: "world",
        kind: "world",
        name: "신제품 출시를 앞둔 회사",
        description:
          "신제품 출시 시점이 다가오면서 내부 부서 간 긴장이 높아진 회사.",
        attributes: { setting: "corporate", timeframe: "pre-launch" },
      },
      {
        key: "org_quality",
        kind: "organization",
        name: "품질팀",
        description: "제품 품질 보증을 책임지는 팀.",
      },
      {
        key: "org_marketing",
        kind: "organization",
        name: "마케팅팀",
        description: "제품 출시 일정과 시장 반응을 책임지는 팀.",
      },
      {
        key: "char_a",
        kind: "character",
        name: "품질팀 리더",
        description: "결함 없는 출시를 최우선으로 하는 품질팀의 리더.",
        attributes: { role: "QA lead", stance: "cautious" },
      },
      {
        key: "char_b",
        kind: "character",
        name: "마케팅팀 리더",
        description: "출시 일정을 지키는 것이 최우선인 마케팅팀의 리더.",
        attributes: { role: "marketing lead", stance: "aggressive" },
      },
      {
        key: "goal_quality",
        kind: "goal",
        name: "품질 보증",
        description: "출시 전 모든 결함을 제거하는 것.",
      },
      {
        key: "goal_launch",
        kind: "goal",
        name: "신속한 출시",
        description: "예정된 날짜에 제품을 출시하는 것.",
      },
      {
        key: "conflict_main",
        kind: "conflict",
        name: "일정 대 품질 충돌",
        description:
          "품질 검증 시간과 출시 일정 사이의 충돌. 두 팀의 목표가 정면으로 대립한다.",
        attributes: { intensity: 0.8 },
      },
      {
        key: "event_meeting",
        kind: "event",
        name: "출시 판정 회의",
        description:
          "출시 여부를 결정하는 회의에서 두 팀의 갈등이 표면화된다.",
      },
    ],
    relationships: [
      { source: "char_a", type: "works_for", target: "org_quality" },
      { source: "char_b", type: "works_for", target: "org_marketing" },
      {
        source: "char_a",
        type: "conflicts_with",
        target: "char_b",
        attributes: { intensity: 0.8, reason: "제품 출시 일정" },
      },
      { source: "org_quality", type: "wants", target: "goal_quality" },
      { source: "org_marketing", type: "wants", target: "goal_launch" },
      { source: "conflict_main", type: "involves", target: "org_quality" },
      { source: "conflict_main", type: "involves", target: "org_marketing" },
      { source: "char_a", type: "participates_in", target: "event_meeting" },
      { source: "char_b", type: "participates_in", target: "event_meeting" },
      { source: "event_meeting", type: "occurs_in", target: "world" },
    ],
  };
}

function genericBlueprint(prompt: string): Blueprint {
  const topic = prompt.trim().slice(0, 60) || "Untitled premise";
  return {
    entities: [
      {
        key: "world",
        kind: "world",
        name: `World of "${topic}"`,
        description: `Setting derived from the premise: ${prompt.trim()}`,
      },
      {
        key: "char_a",
        kind: "character",
        name: "Protagonist",
        description: `Central figure of the premise: ${topic}`,
      },
      {
        key: "char_b",
        kind: "character",
        name: "Antagonist",
        description: "Opposing figure whose goal blocks the protagonist.",
      },
      {
        key: "org_main",
        kind: "organization",
        name: "Central Organization",
        description: "Primary group involved in the premise.",
      },
      {
        key: "goal_a",
        kind: "goal",
        name: "Protagonist's Goal",
        description: "What the protagonist wants to achieve.",
      },
      {
        key: "goal_b",
        kind: "goal",
        name: "Antagonist's Goal",
        description: "What the antagonist wants, incompatible with the protagonist's goal.",
      },
      {
        key: "conflict_main",
        kind: "conflict",
        name: "Central Conflict",
        description: `The core tension of: ${topic}`,
        attributes: { intensity: 0.7 },
      },
      {
        key: "event_incident",
        kind: "event",
        name: "Inciting Incident",
        description: "The event that brings the conflict into the open.",
      },
    ],
    relationships: [
      { source: "char_a", type: "member_of", target: "org_main" },
      { source: "char_a", type: "wants", target: "goal_a" },
      { source: "char_b", type: "wants", target: "goal_b" },
      {
        source: "char_a",
        type: "conflicts_with",
        target: "char_b",
        attributes: { intensity: 0.7 },
      },
      { source: "conflict_main", type: "involves", target: "char_a" },
      { source: "conflict_main", type: "involves", target: "char_b" },
      { source: "char_a", type: "participates_in", target: "event_incident" },
      { source: "event_incident", type: "occurs_in", target: "world" },
    ],
  };
}

const LAUNCH_HINTS = [
  ["품질", "마케팅"],
  ["quality", "marketing"],
] as const;

export class MockProvider implements AIProvider {
  readonly name = "mock";

  async generateGraph(prompt: string): Promise<GenerationResult> {
    const lower = prompt.toLowerCase();
    const isLaunchDemo = LAUNCH_HINTS.some(([a, b]) =>
      lower.includes(a) && lower.includes(b),
    );
    const blueprint = isLaunchDemo
      ? productLaunchBlueprint(prompt)
      : genericBlueprint(prompt);

    const idByKey = new Map<string, string>();
    const entities = blueprint.entities.map((e) => {
      const id = newId("entity");
      idByKey.set(e.key, id);
      const entity: import("../content/model").Entity = {
        id,
        kind: e.kind,
        name: e.name,
        description: e.description,
        attributes: e.attributes ?? {},
      };
      return entity;
    });

    const relationships: Relationship[] = blueprint.relationships.map((r) => ({
      id: newId("relationship"),
      source: idByKey.get(r.source)!,
      type: r.type,
      target: idByKey.get(r.target)!,
      attributes: r.attributes ?? {},
    }));

    return {
      graph: { entities: entities as Entity[], relationships },
      provider: this.name,
      model: "contentx-mock-v1",
    };
  }
}
