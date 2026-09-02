import { Router } from "express";
import {
  SamplingRequestSchema,
  AdaptiveSamplingRequestSchema,
  type SimulationActorSpec,
} from "@workspace/simulation-contract";
import {
  DimensionRegistry,
  CohortGenerator,
  samplingEngine,
  coverageAnalyzer,
  adaptiveSampler,
} from "../domains/population";

const router = Router();

// GET /v1/simulation-populations/dimensions — List dimension space
router.get("/v1/simulation-populations/dimensions", (_req, res) => {
  res.json(DimensionRegistry.list());
});

// GET /v1/simulation-populations/cohorts — List standard archetypal cohorts
router.get("/v1/simulation-populations/cohorts", (_req, res) => {
  res.json(CohortGenerator.listCohorts());
});

// POST /v1/simulation-populations/sample — Sample personas with strategy (random, stratified, boundary, adversarial, scenario_driven)
router.post("/v1/simulation-populations/sample", (req, res) => {
  const parsed = SamplingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = samplingEngine.sample(parsed.data);
  res.status(201).json(result);
});

// POST /v1/simulation-populations/coverage — Analyze behavioral and dimensional coverage of a persona sample
router.post("/v1/simulation-populations/coverage", (req, res) => {
  const personas = req.body?.personas as SimulationActorSpec[];
  if (!Array.isArray(personas)) {
    res.status(400).json({ error: "Personas array is required" });
    return;
  }
  const report = coverageAnalyzer.analyze(personas);
  res.json(report);
});

// POST /v1/simulation-populations/adaptive — Generate adaptive stress cohort based on benchmark failure patterns
router.post("/v1/simulation-populations/adaptive", (req, res) => {
  const parsed = AdaptiveSamplingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = adaptiveSampler.sampleAdaptive(parsed.data);
  res.status(201).json(result);
});

export default router;
