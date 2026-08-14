/**
 * MatrAIx → Evaluation full vertical slice (real DB).
 *
 * Reproducible E2E demo of the entire lifecycle:
 *   import (canonical graph) → Population bridge (dimensions/distributions/
 *   dependency rules) → SamplingRun (10 characters) → CharacterSnapshots
 *   → 2 Agents → deterministic 20+ turn negotiation simulation → trace
 *   → Evaluations → lineage back-trace + Roleplay/Novel projections.
 *
 * Lineage is verified as REFERENCES: from any evaluation back through
 * simulationId → agentId → snapshotId → samplingRunId → populationId
 * → importId → matraixId.
 *
 * Skipped when DATABASE_URL is not configured.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { importMatraix } from "../import/matraixService";
import {
  bridgeImportToPopulations,
  type BridgeResult,
} from "../import/populationBridge";
import * as contentRepo from "../content/repository";
import * as populationService from "../population/service";
import { PopulationReferencedError } from "../population/repository";
import * as characterService from "../character/service";
import * as snapshotService from "../character/snapshotService";
import * as agentService from "../agent/service";
import * as simulationService from "../simulation/service";
import * as evaluationService from "../evaluation/service";
import { resolveEvaluationLineage } from "../evaluation/lineageService";
import * as projectionService from "../projection/service";
import type { CharacterSnapshot } from "../character/snapshotModel";
import type { Simulation, InteractionEvent } from "../simulation/model";
import type { Evaluation } from "../evaluation/model";

const hasDb = Boolean(process.env["DATABASE_URL"]);
const d = hasDb ? describe : describe.skip;

const runTag = `vslice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const dataset = {
  schemaVersion: "matraix/1.0",
  source: {
    uri: `matraix://exports/${runTag}/negotiation-demo`,
    title: "Vertical slice negotiation demo",
  },
  world: {
    id: "world.retail",
    name: "Korean Retail Market",
  },
  populations: [
    {
      id: "pop.negotiators",
      name: `Negotiators ${runTag}`,
      dimensions: [
        { id: "dim.age", name: "vs_age", category: "demographic", dataType: "number" },
        {
          id: "dim.occ",
          name: "vs_occupation",
          category: "professional",
          dataType: "enum",
          allowedValues: ["shop_owner", "marketing_manager", "engineer"],
        },
        {
          id: "dim.risk",
          name: "vs_risk_tolerance",
          category: "psychological",
          dataType: "enum",
          allowedValues: ["low", "medium", "high"],
        },
      ],
    },
  ],
  personas: [
    {
      id: "p.jiyoung",
      name: "Kim Jiyoung",
      populationId: "pop.negotiators",
      attributes: { vs_age: 38, vs_occupation: "marketing_manager", vs_risk_tolerance: "low" },
      goals: ["Find reliable products at fair prices"],
    },
    {
      id: "p.minsu",
      name: "Park Minsu",
      populationId: "pop.negotiators",
      attributes: { vs_age: 45, vs_occupation: "shop_owner", vs_risk_tolerance: "medium" },
      goals: ["Negotiate better wholesale terms"],
    },
    {
      id: "p.seojun",
      name: "Lee Seojun",
      populationId: "pop.negotiators",
      attributes: { vs_age: 31, vs_occupation: "engineer", vs_risk_tolerance: "low" },
    },
    {
      id: "p.haeun",
      name: "Choi Haeun",
      populationId: "pop.negotiators",
      attributes: { vs_age: 42, vs_occupation: "shop_owner", vs_risk_tolerance: "medium" },
    },
  ],
};

const SEED = 20260814;
const SAMPLE_SIZE = 10;
const MAX_TURNS = 30;

// Slice state shared across ordered tests in this file.
let contentId: string;
let bridge: BridgeResult;
let samplingRunId: string;
let characterIds: string[];
let snapshots: CharacterSnapshot[];
let agentIds: string[] = [];
let simulation: Simulation;
let trace: InteractionEvent[];
let evaluations: Evaluation[];

const cleanupCharacterIds: string[] = [];

function agentGoals(objective: string) {
  return [
    {
      objective,
      priority: 3,
      urgency: 0.7,
      successCriteria: ["agreement reached on acceptable terms"],
    },
  ];
}

/** Comparable view of a trace: everything except generated ids/timestamps. */
function comparableTrace(events: InteractionEvent[]) {
  return events.map((e) => ({
    sequence: e.sequence,
    turn: e.turn,
    type: e.type,
    payload: e.payload,
    stateBefore: e.stateBefore,
    stateAfter: e.stateAfter,
  }));
}

d("MatrAIx → Evaluation vertical slice (real DB)", () => {
  beforeAll(async () => {
    const imported = await importMatraix({ dataset });
    contentId = imported.content.id;
    expect(imported.report.validation.valid).toBe(true);
    expect(
      imported.report.importIssues.filter((i) => i.severity === "error"),
    ).toEqual([]);
  }, 30_000);

  afterAll(async () => {
    // Best-effort cleanup of rows without downstream references; used
    // snapshots/simulations are immutable by design and stay. The imported
    // content is intentionally NOT deleted: the bridged population's
    // provenance references it, and deleteContent rejects such deletes
    // (asserted below) to keep evaluation lineage resolvable forever.
    for (const id of cleanupCharacterIds) {
      await characterService.deleteCharacter(id).catch(() => {});
    }
  });

  it("bridges the import into a Population with dimensions, distributions, and dependency rules", async () => {
    const results = await bridgeImportToPopulations({ contentId });
    expect(results).toHaveLength(1);
    bridge = results[0]!;

    expect(bridge.population.dimensions).toEqual([
      "vs_age",
      "vs_occupation",
      "vs_risk_tolerance",
    ]);
    expect(Object.keys(bridge.population.distributions).sort()).toEqual([
      "vs_age",
      "vs_occupation",
      "vs_risk_tolerance",
    ]);
    expect(bridge.rules.length).toBeGreaterThan(0);

    // Provenance is a REFERENCE chain to the import, not a copy.
    const p = bridge.population.provenance;
    expect(p.operation).toBe("import-bridge");
    expect(p.sourceType).toBe("matraix");
    expect(p.importId).toBe(contentId);
    expect(p.sourceUri).toBe(dataset.source.uri);
    expect(p.matraixId).toBe("pop.negotiators");
    for (const rule of bridge.rules) {
      expect(rule.provenance.importId).toBe(contentId);
      expect(rule.provenance.matraixId).toBe("pop.negotiators");
    }
  });

  it("samples 10 characters whose provenance references the sampling run and population", async () => {
    const { run, characterIds: ids } = await populationService.samplePopulation({
      populationId: bridge.population.id,
      sampleSize: SAMPLE_SIZE,
      // "conditional" applies the bridged dependency rules during sampling.
      strategy: "conditional",
      seed: SEED,
    });
    samplingRunId = run.id;
    characterIds = ids;
    cleanupCharacterIds.push(...ids);

    expect(ids).toHaveLength(SAMPLE_SIZE);
    expect(run.populationId).toBe(bridge.population.id);
    expect(run.characterIds).toEqual(ids);

    for (const id of ids) {
      const character = await characterService.getCharacter(id);
      expect(character).not.toBeNull();
      expect(character!.provenance.samplingRunId).toBe(samplingRunId);
      expect(character!.provenance.populationId).toBe(bridge.population.id);
      // Derived dependency rule held: occupation determines risk tolerance.
      const occ = character!.attributes.professional?.["vs_occupation"];
      const risk = character!.attributes.psychological?.["vs_risk_tolerance"];
      if (occ === "shop_owner") expect(risk).toBe("medium");
      if (occ === "marketing_manager" || occ === "engineer") {
        expect(risk).toBe("low");
      }
    }

    // Lineage protection kicks in as soon as sampling exists — even before
    // any snapshot: deleting the population would cascade the sampling run
    // and orphan the sampled characters' provenance.
    await expect(
      populationService.deletePopulation(bridge.population.id),
    ).rejects.toBeInstanceOf(PopulationReferencedError);
  });

  it("creates snapshots that carry the full sampling lineage", async () => {
    snapshots = [];
    for (const id of characterIds) {
      snapshots.push(await snapshotService.createSnapshot({ characterId: id }));
    }
    expect(snapshots).toHaveLength(SAMPLE_SIZE);
    for (const s of snapshots) {
      expect(s.populationId).toBe(bridge.population.id);
      expect(s.provenance.samplingRunId).toBe(samplingRunId);
      expect(s.provenance.seed).toBe(SEED);
    }
  });

  it("instantiates 2 agents and runs a deterministic 20+ turn negotiation with trace", async () => {
    const buyer = await agentService.createAgent({
      snapshotId: snapshots[0]!.id,
      name: "Buyer",
      goals: agentGoals("Buy wholesale inventory at a fair price"),
      constraints: [],
    });
    const seller = await agentService.createAgent({
      snapshotId: snapshots[1]!.id,
      name: "Seller",
      goals: agentGoals("Sell wholesale inventory at a sustainable margin"),
      constraints: [],
    });
    agentIds = [buyer.id, seller.id];

    simulation = await simulationService.runSimulation({
      name: `Wholesale negotiation ${runTag}`,
      topic: "wholesale supply contract negotiation",
      agentIds,
      seed: SEED,
      maxTurns: MAX_TURNS,
      roles: ["buyer", "seller"],
    });

    expect(simulation.status).toBe("completed");
    expect(simulation.turnsExecuted).toBeGreaterThanOrEqual(1);
    expect(simulation.turnsExecuted).toBeLessThanOrEqual(MAX_TURNS);
    expect(simulation.outcome).not.toBeNull();
    expect(simulation.provenance.snapshotIds).toEqual([
      snapshots[0]!.id,
      snapshots[1]!.id,
    ]);

    trace = (await simulationService.listEvents(simulation.id)) ?? [];
    expect(trace.length).toBeGreaterThanOrEqual(20);

    // Participating snapshots are now marked used (immutable from here on).
    for (const sid of [snapshots[0]!.id, snapshots[1]!.id]) {
      const s = await snapshotService.getSnapshot(sid);
      expect(s!.usedBySimulation).toBe(true);
    }
  });

  it("produces evaluations for the simulation and both agents", async () => {
    evaluations = await evaluationService.evaluateSimulation({
      simulationId: simulation.id,
    });
    // behavior + personaFidelity per agent, plus one outcome evaluation.
    expect(evaluations).toHaveLength(5);
    const kinds = evaluations.map((e) => e.kind).sort();
    expect(kinds).toEqual([
      "behavior",
      "behavior",
      "outcome",
      "personaFidelity",
      "personaFidelity",
    ]);
    for (const e of evaluations) {
      expect(e.provenance.simulationId).toBe(simulation.id);
      expect(e.provenance.traceEventCount).toBe(trace.length);
    }
  });

  it("back-traces lineage from EVERY evaluation to the MatrAIx import", async () => {
    for (const evaluation of evaluations) {
      const lineage = await resolveEvaluationLineage(evaluation.id);
      expect(lineage.simulationId).toBe(simulation.id);
      expect(lineage.simulationSeed).toBe(SEED);
      expect(lineage.agents.length).toBeGreaterThan(0);
      if (evaluation.subjectType === "agent") {
        expect(lineage.agents).toHaveLength(1);
        expect(lineage.agents[0]!.agentId).toBe(evaluation.subjectId);
      }
      for (const a of lineage.agents) {
        expect(agentIds).toContain(a.agentId);
        expect([snapshots[0]!.id, snapshots[1]!.id]).toContain(a.snapshotId);
        expect(characterIds).toContain(a.characterId);
        expect(a.samplingRunId).toBe(samplingRunId);
        expect(a.populationId).toBe(bridge.population.id);
        expect(a.importId).toBe(contentId);
        expect(a.matraixId).toBe("pop.negotiators");
        expect(a.sourceUri).toBe(dataset.source.uri);
      }
    }
  });

  it("rejects deleting the imported content or bridged population while lineage depends on them", async () => {
    await expect(contentRepo.deleteContent(contentId)).rejects.toBeInstanceOf(
      contentRepo.ContentReferencedError,
    );
    await expect(
      populationService.deletePopulation(bridge.population.id),
    ).rejects.toBeInstanceOf(PopulationReferencedError);
    // The lineage above must still resolve after the rejected delete.
    const lineage = await resolveEvaluationLineage(evaluations[0]!.id);
    expect(lineage.agents[0]!.importId).toBe(contentId);
  });

  it("reproduces the identical trace and outcome for the same seed and snapshots", async () => {
    const rerun = await simulationService.runSimulation({
      name: `Wholesale negotiation rerun ${runTag}`,
      topic: "wholesale supply contract negotiation",
      agentIds,
      seed: SEED,
      maxTurns: MAX_TURNS,
      roles: ["buyer", "seller"],
    });
    // NOTE: agent runtime state was mutated by the first run, but the
    // engine derives behavior from snapshot + seed + captured start state;
    // determinism is asserted on outcome-shape and trace structure of a
    // fresh identical-seed pair below instead of raw state equality.
    expect(rerun.status).toBe("completed");

    // True reproducibility check: two fresh agents from the same snapshots
    // with identical goals/seed produce an identical trace and outcome.
    const mk = async () => {
      const a = await agentService.createAgent({
        snapshotId: snapshots[2]!.id,
        name: "Buyer R",
        goals: agentGoals("Buy wholesale inventory at a fair price"),
        constraints: [],
      });
      const b = await agentService.createAgent({
        snapshotId: snapshots[3]!.id,
        name: "Seller R",
        goals: agentGoals("Sell wholesale inventory at a sustainable margin"),
        constraints: [],
      });
      const sim = await simulationService.runSimulation({
        name: `Repro negotiation ${runTag} ${a.id}`,
        topic: "wholesale supply contract negotiation",
        agentIds: [a.id, b.id],
        seed: SEED,
        maxTurns: MAX_TURNS,
        roles: ["buyer", "seller"],
      });
      const t = (await simulationService.listEvents(sim.id)) ?? [];
      return { sim, trace: t, agentIds: [a.id, b.id] };
    };
    const first = await mk();
    const second = await mk();

    const anonymize = (value: unknown, ids: string[]) =>
      JSON.parse(
        JSON.stringify(value)
          .replaceAll(ids[0]!, "AGENT_A")
          .replaceAll(ids[1]!, "AGENT_B"),
      );
    expect(anonymize(comparableTrace(second.trace), second.agentIds)).toEqual(
      anonymize(comparableTrace(first.trace), first.agentIds),
    );
    expect(second.sim.turnsExecuted).toBe(first.sim.turnsExecuted);
    expect(anonymize(second.sim.outcome, second.agentIds)).toEqual(
      anonymize(first.sim.outcome, first.agentIds),
    );
  });

  it("evaluation is reproducible over the immutable trace", async () => {
    const again = await evaluationService.evaluateSimulation({
      simulationId: simulation.id,
    });
    const key = (e: Evaluation) => `${e.kind}:${e.subjectType}:${e.subjectId}`;
    const byKey = new Map(again.map((e) => [key(e), e]));
    for (const original of evaluations) {
      const repeat = byKey.get(key(original));
      expect(repeat).toBeDefined();
      expect(repeat!.scores).toEqual(original.scores);
      expect(repeat!.findings).toEqual(original.findings);
    }
  });

  it("Roleplay projection consumes the slice's snapshots, trace, and evaluations", async () => {
    const result = await projectionService.project({
      target: "roleplayx",
      contentId,
      simulationId: simulation.id,
    });
    expect(result.target).toBe("roleplayx");

    const layers = result.provenance.map((l) => l.layer);
    expect(layers).toContain("simulation");
    expect(layers[layers.length - 1]).toBe("projection");
    const simLink = result.provenance.find((l) => l.layer === "simulation");
    expect(simLink).toMatchObject({
      simulationId: simulation.id,
      seed: SEED,
      snapshotIds: [snapshots[0]!.id, snapshots[1]!.id],
    });
    expect(
      (simLink as { evaluationIds: string[] }).evaluationIds.length,
    ).toBeGreaterThan(0);

    // The payload actually references this slice's runtime results: the
    // sampled characters (snapshot lineage) and the simulation trace.
    const raw = JSON.stringify(result.payload);
    expect(raw).toContain(snapshots[0]!.characterId);
    expect(raw).toContain(snapshots[1]!.characterId);
    for (const agentId of agentIds) expect(raw).toContain(agentId);
  });

  it("Novel projection source resolution provides the slice's full simulation bundle", async () => {
    // The novel adapter is LLM-backed (covered by its own unit tests); here
    // we verify the projection CONTRACT: the resolver hands any adapter the
    // slice's simulation, trace, snapshots, and evaluations unchanged.
    const source = await projectionService.resolveSource({
      contentId,
      simulationId: simulation.id,
    });
    expect(source.graph?.id).toBe(contentId);
    expect(source.simulation?.simulation.id).toBe(simulation.id);
    expect(source.simulation?.trace.length).toBe(trace.length);
    expect(source.simulation?.snapshots.map((s) => s.id)).toEqual([
      snapshots[0]!.id,
      snapshots[1]!.id,
    ]);
    expect(
      source.simulation?.evaluations.map((e) => e.id).sort(),
    ).toEqual(expect.arrayContaining(evaluations.map((e) => e.id)));
  });
});
