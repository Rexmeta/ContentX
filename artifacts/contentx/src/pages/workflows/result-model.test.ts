/**
 * Regression tests: completed narrative workflows must surface the generated
 * output using the actual projection contracts —
 * novel: scenes[{heading, prose}], roleplayx: context/objectives/personas/
 * recommendedFlow. Guards against the result screen silently rendering empty.
 */
import { describe, it, expect } from "vitest";
import { getNarrativeResult } from "./result-model";

describe("getNarrativeResult", () => {
  it("maps a novel projection payload (heading/prose) onto visible scenes", () => {
    const view = getNarrativeResult({
      title: "정거장의 신호",
      logline: "고립된 두 연구원이 정체불명의 신호를 발견한다",
      theme: "고립과 신뢰",
      characters: [{ name: "지우", arc: "회의론자에서 믿는 자로" }],
      scenes: [
        { heading: "1장 — 침묵", prose: "우주 정거장의 복도는 조용했다..." },
        { heading: "2장 — 신호", prose: "수신기가 갑자기 울리기 시작했다..." },
      ],
    });
    expect(view?.kind).toBe("novel");
    if (view?.kind !== "novel") return;
    expect(view.title).toBe("정거장의 신호");
    expect(view.subtitle).toContain("고립된 두 연구원");
    expect(view.characters).toEqual([
      { name: "지우", arc: "회의론자에서 믿는 자로" },
    ]);
    expect(view.scenes).toHaveLength(2);
    expect(view.scenes[0]).toEqual({
      heading: "1장 — 침묵",
      prose: "우주 정거장의 복도는 조용했다...",
    });
    // Prose must never be dropped — that was the original regression.
    for (const s of view.scenes) expect(s.prose.length).toBeGreaterThan(0);
  });

  it("maps a roleplayx projection payload onto the roleplay view", () => {
    const view = getNarrativeResult({
      title: "정거장 협상",
      context: "당신은 우주 정거장의 통신 책임자다.",
      playerRole: "통신 책임자",
      objectives: ["신호의 정체 밝히기", "동료 설득하기"],
      successCriteria: ["합의 도달"],
      personas: [
        {
          id: "p1",
          name: "지우",
          role: "연구원",
          background: "10년차 신호 분석가",
          traits: ["신중함", "회의적"],
        },
      ],
      recommendedFlow: ["상황 파악", "증거 제시", "결론 도출"],
      environment: null,
      evaluationContract: null,
    });
    expect(view?.kind).toBe("roleplay");
    if (view?.kind !== "roleplay") return;
    expect(view.context).toContain("통신 책임자");
    expect(view.playerRole).toBe("통신 책임자");
    expect(view.objectives).toHaveLength(2);
    expect(view.personas[0]).toMatchObject({
      name: "지우",
      role: "연구원",
      background: "10년차 신호 분석가",
      traits: ["신중함", "회의적"],
    });
    expect(view.recommendedFlow).toEqual(["상황 파악", "증거 제시", "결론 도출"]);
  });

  it("returns null for unrecognized or empty payloads", () => {
    expect(getNarrativeResult(null)).toBeNull();
    expect(getNarrativeResult(undefined)).toBeNull();
    expect(getNarrativeResult({})).toBeNull();
    expect(getNarrativeResult({ summary: "not narrative" })).toBeNull();
  });
});
