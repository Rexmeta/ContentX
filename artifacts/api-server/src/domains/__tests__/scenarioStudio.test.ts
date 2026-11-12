import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScenarioGraphDraft } from "@workspace/api-zod";
import { completeJSON } from "../ai/llmClient";
import { commitGraph } from "../content/service";
import { collectScenarioSources } from "../scenario/studioResearch";
import router from "../../routes/scenarioStudio";

vi.mock("../ai/llmClient", () => ({ completeJSON: vi.fn() }));
vi.mock("../content/service", () => ({ commitGraph: vi.fn() }));

const app = express();
app.use(express.json());
app.use("/api", router);
const brief = { industry: "제조", organization: "품질팀", focus: "납기와 검수 기준의 충돌" };
const api = "/api/v1/scenario-studio";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("scenario studio", () => {
  it("collects distinct public links and falls back to Wikipedia", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
      String(input).includes("brave.com")
        ? new Response(null, { status: 503 })
        : Response.json({ query: { search: [{ pageid: 9, title: "품질관리", snippet: "<span>검수</span> 절차" }] } }));
    const result = await collectScenarioSources(brief, fetch, "test-key");

    expect(result).toEqual({
      provider: "wikipedia",
      sources: [{ id: expect.stringMatching(/^entity_/), url: "https://ko.wikipedia.org/?curid=9", title: "품질관리", excerpt: "검수 절차" }],
    });
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls.every(([url]) => !String(url).includes(encodeURIComponent(brief.focus)))).toBe(true);
  });

  it("returns candidate categories and removes invented source references", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ query: { search: [{ pageid: 9, title: "품질", snippet: "검수 절차" }] } })));
    vi.mocked(completeJSON).mockImplementation(async ({ user }) => {
      const { sources } = JSON.parse(user);
      return {
        candidates: ["event", "situation", "evidence", "tradeoff", "conflict", "relationship", "opposition"].map((kind) => ({
          kind, title: kind, detail: "납품 당일 검사 기록이 누락된다.", sourceIds: kind === "evidence" ? [sources[0].id, "invented"] : [],
        })),
      };
    });
    const response = await request(app).post(`${api}/research`).send(brief).expect(200);

    expect(response.body.candidates).toHaveLength(7);
    expect(response.body.candidates[2].sourceIds).toEqual([response.body.sources[0].id]);
  });

  it("validates and commits the edited draft while preserving its references and scene IDs", async () => {
    vi.mocked(completeJSON).mockResolvedValue({
      title: "출하 결정",
      entities: [
        { id: "story", kind: "narrative", name: "출하 결정" },
        { id: "event", kind: "event", name: "검사 기록 누락" },
        { id: "person", kind: "character", name: "품질 리더" },
        { id: "conflict", kind: "conflict", name: "고객 납기와 안전" },
        { id: "scene", kind: "action", name: "전화", attributes: { order: 1, seconds: 12, beat: "hook", line: "지금 출하해도 됩니까?" } },
      ],
      relationships: [{ id: "causes", source: "event", target: "conflict", type: "causes" }],
    });

    const response = await request(app).post(`${api}/draft`).send({
      brief, direction: "납기 지연 비용 포함", candidates: [],
      sources: [{ id: "entity_source", title: "품질관리", url: "https://example.com/quality", excerpt: "검수 절차" }],
    }).expect(200);
    const draft: ScenarioGraphDraft = response.body;
    expect(draft.entities).toContainEqual(expect.objectContaining({ id: "entity_source", attributes: expect.objectContaining({ sourceUri: "https://example.com/quality" }) }));
    expect(draft.relationships).toContainEqual(expect.objectContaining({ target: "entity_source", type: "reference_material" }));

    const edited = { ...draft, title: "수정한 출하 결정" };
    const saved = { ...edited, id: "content_test", version: 1, createdAt: "2026-11-12T00:00:00Z", updatedAt: "2026-11-12T00:00:00Z" };
    vi.mocked(commitGraph).mockResolvedValue(saved);
    await request(app).post(`${api}/commit`).send(edited).expect(201);
    expect(commitGraph).toHaveBeenCalledWith(edited.sourcePrompt, expect.objectContaining({
      entities: edited.entities, relationships: edited.relationships,
    }), edited.title);

    await request(app).post(`${api}/commit`).send({
      ...edited, relationships: [{ id: "relationship_bad", source: "entity_source", target: "entity_missing", type: "related_to" }],
    }).expect(422);
    expect(commitGraph).toHaveBeenCalledTimes(1);
  });
});
