import { Router } from "express";
import {
  validateSimulationSpec,
  type SimulationSpec,
  type ReplayMode,
} from "@workspace/simulation-contract";
import { simulationSpecService } from "../domains/simulation/specService";

const router = Router();

// POST /v1/simulation-specs — Create a new SimulationSpec
router.post("/v1/simulation-specs", (req, res) => {
  try {
    const spec = req.body as SimulationSpec;
    const created = simulationSpecService.createSpec(spec);
    res.status(201).json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid specification";
    res.status(400).json({ error: message });
  }
});

// POST /v1/simulation-specs/validate — Validate a SimulationSpec without persisting
router.post("/v1/simulation-specs/validate", (req, res) => {
  const report = validateSimulationSpec(req.body);
  res.json(report);
});

// POST /v1/simulations/compile — Auto-compile prompt into SimulationSpec
router.post("/v1/simulations/compile", (req, res) => {
  try {
    const { prompt, domain, name, maxTurns, customerPersona, agentModel } = req.body;
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "Prompt string is required" });
      return;
    }
    const compiled = simulationSpecService.compileSpec({
      prompt,
      domain,
      name,
      maxTurns,
      customerPersona,
      agentModel,
    });
    res.status(201).json(compiled);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Compilation failed";
    res.status(500).json({ error: message });
  }
});

// GET /v1/simulation-specs/:id — Get a SimulationSpec
router.get("/v1/simulation-specs/:id", (req, res) => {
  const spec = simulationSpecService.getSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: `SimulationSpec "${req.params.id}" not found` });
    return;
  }
  res.json(spec);
});

// GET /v1/simulation-specs — List all SimulationSpecs
router.get("/v1/simulation-specs", (_req, res) => {
  res.json(simulationSpecService.listSpecs());
});

// POST /v1/simulations/:id/run — Run simulation for a spec
router.post("/v1/simulations/:id/run", async (req, res) => {
  try {
    const specId = req.params.id;
    const { simulationId, runId } = req.body || {};
    const result = await simulationSpecService.runSpec(specId, { simulationId, runId });
    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Simulation execution failed";
    res.status(400).json({ error: message });
  }
});

// GET /v1/simulations/:id/runs — List runs for a simulation
router.get("/v1/simulations/:id/runs", (req, res) => {
  const runs = simulationSpecService.listRuns(req.params.id);
  res.json(runs);
});

// GET /v1/runs/:id/trajectory — Get trajectory of a run
router.get("/v1/runs/:id/trajectory", (req, res) => {
  const trajectory = simulationSpecService.getTrajectory(req.params.id);
  if (!trajectory) {
    res.status(404).json({ error: `Trajectory for run "${req.params.id}" not found` });
    return;
  }
  res.json(trajectory);
});

// GET /v1/runs/:id/evaluation — Get evaluation of a run
router.get("/v1/runs/:id/evaluation", (req, res) => {
  const evaluation = simulationSpecService.getEvaluation(req.params.id);
  if (!evaluation) {
    res.status(404).json({ error: `Evaluation for run "${req.params.id}" not found` });
    return;
  }
  res.json(evaluation);
});

// POST /v1/runs/:id/replay — Replay a run (recorded or reexecute)
router.post("/v1/runs/:id/replay", async (req, res) => {
  try {
    const mode: ReplayMode = req.body?.mode ?? "recorded";
    const replayed = await simulationSpecService.replayRun(req.params.id, mode);
    res.status(201).json(replayed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Replay failed";
    res.status(400).json({ error: message });
  }
});

export default router;
