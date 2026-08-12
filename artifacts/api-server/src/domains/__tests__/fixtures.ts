import type { ContentGraph, GraphPayload } from "../content/model";

export function validGraphPayload(): GraphPayload {
  return {
    entities: [
      { id: "entity_qa1", kind: "character", name: "QA Lead", description: "Cautious lead", attributes: { role: "QA lead" } },
      { id: "entity_mk1", kind: "character", name: "Marketing Lead", attributes: { role: "marketing lead", stance: "aggressive" } },
      { id: "entity_org1", kind: "organization", name: "Quality Team" },
      { id: "entity_goal1", kind: "goal", name: "Zero defects", description: "Ship without defects" },
      { id: "entity_conf1", kind: "conflict", name: "Schedule vs quality", description: "Core clash" },
      { id: "entity_ev1", kind: "event", name: "Launch review meeting" },
      { id: "entity_w1", kind: "world", name: "Pre-launch company", description: "Corporate setting" },
    ],
    relationships: [
      { id: "relationship_r1", source: "entity_qa1", type: "works_for", target: "entity_org1" },
      { id: "relationship_r2", source: "entity_qa1", type: "conflicts_with", target: "entity_mk1", attributes: { intensity: 0.8 } },
      { id: "relationship_r3", source: "entity_org1", type: "wants", target: "entity_goal1" },
      { id: "relationship_r4", source: "entity_conf1", type: "involves", target: "entity_org1" },
      { id: "relationship_r5", source: "entity_ev1", type: "occurs_in", target: "entity_w1" },
    ],
    provenance: {
      operation: "generate",
      createdAt: "2026-08-12T00:00:00.000Z",
      sourceType: "prompt",
      generatedByProvider: "mock",
      generatedByModel: "contentx-mock-v1",
    },
  };
}

export function validContentGraph(): ContentGraph {
  return {
    id: "content_demo1",
    title: "Launch Clash",
    sourcePrompt: "신제품 출시를 앞둔 회사에서 품질팀과 마케팅팀이 충돌한다.",
    version: 3,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T01:00:00.000Z",
    ...validGraphPayload(),
  };
}
