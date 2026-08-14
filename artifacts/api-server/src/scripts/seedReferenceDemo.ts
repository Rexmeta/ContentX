/**
 * ContentX Reference Demo seeder.
 *
 * Creates ONE canonical demonstration of the full lifecycle against the dev DB:
 *
 *   MatrAIx import → canonical graph → Population bridge (6 dimensions,
 *   derived dependency rules) → deterministic SamplingRun (10 characters)
 *   → CharacterSnapshots → 2 runtime Agents → seeded wholesale-negotiation
 *   Simulation → trace → Evaluations → lineage back-trace → RoleplayX
 *   projection.
 *
 * The script is idempotent: it keys off the fixed MatrAIx source URI. If the
 * demo population already exists, it reports the existing IDs and exits
 * without creating duplicates. No result is fabricated — every stage runs
 * through the real domain services and is persisted with real provenance.
 *
 * Run: pnpm --filter @workspace/api-server run demo:seed
 */
import { importMatraix } from "../domains/import/matraixService";
import { bridgeImportToPopulations } from "../domains/import/populationBridge";
import * as populationService from "../domains/population/service";
import * as characterService from "../domains/character/service";
import * as snapshotService from "../domains/character/snapshotService";
import * as agentService from "../domains/agent/service";
import * as simulationService from "../domains/simulation/service";
import * as evaluationService from "../domains/evaluation/service";
import { resolveEvaluationLineage } from "../domains/evaluation/lineageService";
import * as projectionService from "../domains/projection/service";
import { ensureSeedDimensions } from "../domains/population/dimensionService";

export const DEMO_SOURCE_URI = "matraix://exports/reference-demo/wholesale-negotiation";
export const DEMO_SEED = 20260101;
const SAMPLE_SIZE = 10;
const MAX_TURNS = 24;

/**
 * Wholesale-negotiation world. Persona attributes are functionally
 * consistent so the population bridge derives real dependency rules:
 *   occupation  → negotiation_style
 *   experience  → risk_tolerance
 */
const dataset = {
  schemaVersion: "matraix/1.0",
  source: {
    uri: DEMO_SOURCE_URI,
    title: "ContentX Reference Demo — Wholesale Negotiation",
  },
  world: {
    id: "world.wholesale",
    name: "Wholesale Negotiation Market",
  },
  populations: [
    {
      id: "pop.b2b-negotiators",
      name: "B2B Negotiators",
      dimensions: [
        { id: "dim.age", name: "demo_age", category: "demographic", dataType: "number" },
        {
          id: "dim.occupation",
          name: "demo_occupation",
          category: "professional",
          dataType: "enum",
          allowedValues: ["sales_manager", "purchasing_manager", "shop_owner"],
        },
        {
          id: "dim.experience",
          name: "demo_experience",
          category: "professional",
          dataType: "enum",
          allowedValues: ["junior", "mid", "senior"],
        },
        {
          id: "dim.risk",
          name: "demo_risk_tolerance",
          category: "psychological",
          dataType: "enum",
          allowedValues: ["low", "medium", "high"],
        },
        {
          id: "dim.style",
          name: "demo_negotiation_style",
          category: "behavioral",
          dataType: "enum",
          allowedValues: ["collaborative", "competitive", "accommodating"],
        },
        {
          id: "dim.goal",
          name: "demo_goal_orientation",
          category: "psychological",
          dataType: "enum",
          allowedValues: ["margin", "volume", "relationship"],
        },
      ],
    },
  ],
  personas: [
    {
      id: "p.sunwoo",
      name: "Han Sunwoo",
      populationId: "pop.b2b-negotiators",
      attributes: {
        demo_age: 41,
        demo_occupation: "sales_manager",
        demo_experience: "senior",
        demo_risk_tolerance: "high",
        demo_negotiation_style: "competitive",
        demo_goal_orientation: "margin",
      },
      goals: ["Close quarterly wholesale contracts above target margin"],
    },
    {
      id: "p.jiyoung",
      name: "Kim Jiyoung",
      populationId: "pop.b2b-negotiators",
      attributes: {
        demo_age: 38,
        demo_occupation: "purchasing_manager",
        demo_experience: "mid",
        demo_risk_tolerance: "medium",
        demo_negotiation_style: "collaborative",
        demo_goal_orientation: "volume",
      },
      goals: ["Secure reliable supply at predictable prices"],
    },
    {
      id: "p.minsu",
      name: "Park Minsu",
      populationId: "pop.b2b-negotiators",
      attributes: {
        demo_age: 52,
        demo_occupation: "shop_owner",
        demo_experience: "senior",
        demo_risk_tolerance: "high",
        demo_negotiation_style: "accommodating",
        demo_goal_orientation: "relationship",
      },
      goals: ["Keep long-term suppliers while protecting cash flow"],
    },
    {
      id: "p.haeun",
      name: "Choi Haeun",
      populationId: "pop.b2b-negotiators",
      attributes: {
        demo_age: 29,
        demo_occupation: "sales_manager",
        demo_experience: "junior",
        demo_risk_tolerance: "low",
        demo_negotiation_style: "competitive",
        demo_goal_orientation: "margin",
      },
      goals: ["Prove herself with clean, well-priced deals"],
    },
    {
      id: "p.seojun",
      name: "Lee Seojun",
      populationId: "pop.b2b-negotiators",
      attributes: {
        demo_age: 45,
        demo_occupation: "purchasing_manager",
        demo_experience: "mid",
        demo_risk_tolerance: "medium",
        demo_negotiation_style: "collaborative",
        demo_goal_orientation: "volume",
      },
      goals: ["Consolidate suppliers without disrupting inventory"],
    },
    {
      id: "p.dara",
      name: "Song Dara",
      populationId: "pop.b2b-negotiators",
      attributes: {
        demo_age: 33,
        demo_occupation: "shop_owner",
        demo_experience: "junior",
        demo_risk_tolerance: "low",
        demo_negotiation_style: "accommodating",
        demo_goal_orientation: "relationship",
      },
      goals: ["Build a dependable supplier network for a new store"],
    },
  ],
};

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

async function findExistingDemoPopulation() {
  const populations = await populationService.listPopulations();
  return (
    populations.find((p) => p.provenance?.sourceUri === DEMO_SOURCE_URI) ?? null
  );
}

export async function seedReferenceDemo(): Promise<Record<string, unknown>> {
  await ensureSeedDimensions();

  const existing = await findExistingDemoPopulation();
  if (existing) {
    // A demo population exists — verify the COMPLETE demo state before
    // reporting success. A partial earlier run must fail loudly, never be
    // silently reported as seeded.
    const missing: string[] = [];
    const runs = await populationService.listSamplingRuns(existing.id);
    const run = runs.find((r) => r.seed === DEMO_SEED);
    if (!run) missing.push(`sampling run with seed ${DEMO_SEED}`);
    if (run && run.characterIds.length !== SAMPLE_SIZE) {
      missing.push(`${SAMPLE_SIZE} sampled characters (found ${run.characterIds.length})`);
    }
    const simulations = await simulationService.listSimulations();
    const simulation = simulations.find(
      (s) =>
        s.name === "Wholesale Negotiation (Reference Demo)" &&
        s.seed === DEMO_SEED &&
        s.status === "completed",
    );
    if (!simulation) missing.push("completed reference simulation");
    const evaluations = simulation
      ? await evaluationService.listEvaluations(simulation.id)
      : [];
    if (simulation && evaluations.length < 5) {
      missing.push(`5 evaluations (found ${evaluations.length})`);
    }
    if (missing.length > 0) {
      throw new Error(
        `Reference demo population "${existing.id}" exists but the demo is incomplete — missing: ${missing.join(", ")}. ` +
          "A previous seed run likely failed partway. Remove the partial demo data (or the population) and re-run demo:seed.",
      );
    }
    return {
      status: "already-seeded",
      populationId: existing.id,
      populationVersion: existing.version,
      importId: existing.provenance.importId,
      sourceUri: DEMO_SOURCE_URI,
      samplingRunId: run!.id,
      seed: DEMO_SEED,
      simulationId: simulation!.id,
      evaluationIds: evaluations.map((e) => ({ id: e.id, kind: e.kind })),
    };
  }

  // 1) SOURCE → canonical graph
  const imported = await importMatraix({ dataset });
  if (!imported.report.validation.valid) {
    throw new Error(
      `Demo import failed validation: ${JSON.stringify(imported.report.validation.issues)}`,
    );
  }
  const contentId = imported.content.id;

  // 2) POPULATION (bridge derives dimensions/distributions/dependency rules)
  const [bridge] = await bridgeImportToPopulations({ contentId });
  if (!bridge) throw new Error("Population bridge produced no population.");

  // 3) SAMPLING → CHARACTERS (deterministic, seeded, rule-constrained)
  const { run, characterIds } = await populationService.samplePopulation({
    populationId: bridge.population.id,
    sampleSize: SAMPLE_SIZE,
    strategy: "conditional",
    seed: DEMO_SEED,
  });

  // 4) SNAPSHOTS (immutable resolved state, full sampling lineage)
  const snapshots = [];
  for (const id of characterIds) {
    snapshots.push(await snapshotService.createSnapshot({ characterId: id }));
  }

  // 5) AGENTS (runtime actors bound to snapshots)
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

  // 6) SIMULATION → BEHAVIOR (seeded, deterministic runtime)
  const simulation = await simulationService.runSimulation({
    name: "Wholesale Negotiation (Reference Demo)",
    topic: "wholesale supply contract negotiation",
    agentIds: [buyer.id, seller.id],
    seed: DEMO_SEED,
    maxTurns: MAX_TURNS,
    roles: ["buyer", "seller"],
  });
  const trace = (await simulationService.listEvents(simulation.id)) ?? [];

  // 7) EVALUATION (trace-based, persisted with provenance)
  const evaluations = await evaluationService.evaluateSimulation({
    simulationId: simulation.id,
  });

  // 8) Lineage sanity: every evaluation must trace back to the import.
  for (const evaluation of evaluations) {
    const lineage = await resolveEvaluationLineage(evaluation.id);
    for (const a of lineage.agents) {
      if (a.importId !== contentId) {
        throw new Error(
          `Lineage broken in seeded demo: evaluation ${evaluation.id} does not trace to import ${contentId}.`,
        );
      }
    }
  }

  // 9) CONTENT: prove projection works from the seeded world + simulation.
  //    Projections are stateless/computed on demand — nothing to persist.
  const roleplay = await projectionService.project({
    target: "roleplayx",
    contentId,
    simulationId: simulation.id,
  });

  return {
    status: "seeded",
    importId: contentId,
    contentVersion: imported.content.version,
    populationId: bridge.population.id,
    populationVersion: bridge.population.version,
    dependencyRules: bridge.rules.length,
    samplingRunId: run.id,
    seed: DEMO_SEED,
    characterIds,
    snapshotIds: snapshots.map((s) => s.id),
    agentIds: [buyer.id, seller.id],
    simulationId: simulation.id,
    turnsExecuted: simulation.turnsExecuted,
    traceEvents: trace.length,
    evaluationIds: evaluations.map((e) => ({ id: e.id, kind: e.kind })),
    projection: {
      target: roleplay.target,
      provenanceLayers: roleplay.provenance.map((p) => p.layer),
    },
  };
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");

if (isMain) {
  seedReferenceDemo()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
