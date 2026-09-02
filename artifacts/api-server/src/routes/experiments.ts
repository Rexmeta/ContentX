import { Router } from "express";
import {
  ExperimentSpecSchema,
  type SimulationSpec,
} from "@workspace/simulation-contract";
import { scalableSimulationOrchestrator } from "../domains/simulation/orchestrator";
import { simulationSpecService } from "../domains/simulation/specService";
import { adaptiveLoopService } from "../domains/simulation/adaptiveLoopService";
import { datasetPackageManager } from "../domains/simulation/datasetPackage";
import { benchmarkAggregator } from "../domains/simulation/benchmarkAggregator";

const router = Router();

// POST /v1/experiments/run — Execute an experiment via the Scalable Simulation Orchestrator
router.post("/v1/experiments/run", async (req, res) => {
  try {
    const parsed = ExperimentSpecSchema.safeParse(req.body.experiment);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const inlineSpecs = (req.body.specs ?? []) as SimulationSpec[];
    const resolvedSpecs: SimulationSpec[] = [];

    for (const specId of parsed.data.specIds) {
      const s = simulationSpecService.getSpec(specId) ?? inlineSpecs.find((x) => x.id === specId);
      if (s) resolvedSpecs.push(s);
    }

    if (resolvedSpecs.length === 0) {
      res.status(400).json({ error: "At least one valid SimulationSpec is required" });
      return;
    }

    const report = await scalableSimulationOrchestrator.executeExperiment(
      parsed.data,
      resolvedSpecs
    );

    res.status(201).json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Experiment execution failed";
    res.status(500).json({ error: message });
  }
});

// POST /v1/benchmarks/adaptive-loop — Execute Adaptive Stress Testing Closed-Loop
router.post("/v1/benchmarks/adaptive-loop", async (req, res) => {
  try {
    const { spec, targetAgent, baselineSampleSize, stressSampleSize, stressIntensity } = req.body || {};
    if (!spec || !targetAgent) {
      res.status(400).json({ error: "spec and targetAgent objects are required" });
      return;
    }

    const result = await adaptiveLoopService.runAdaptiveLoop({
      spec,
      targetAgent,
      baselineSampleSize,
      stressSampleSize,
      stressIntensity,
    });

    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Adaptive loop failed";
    res.status(500).json({ error: message });
  }
});

// POST /v1/benchmarks/:id/package — Export complete reproducible Benchmark Dataset Package
router.post("/v1/benchmarks/:id/package", (req, res) => {
  try {
    const { benchmark, experiments, experimentReports, specifications, coverageReport } = req.body || {};
    if (!benchmark) {
      res.status(400).json({ error: "benchmark report is required to generate dataset package" });
      return;
    }

    const datasetPackage = datasetPackageManager.buildPackage({
      benchmark,
      experiments: experiments ?? [],
      experimentReports: experimentReports ?? [],
      specifications: specifications ?? [],
      coverageReport,
    });

    res.status(201).json(datasetPackage);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Package generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
