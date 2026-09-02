import { Router } from "express";
import type {
  SimulationSpec,
  SimulationActorSpec,
  ComprehensiveBenchmarkReport,
} from "@workspace/simulation-contract";
import { simulationMatrixRunner } from "../domains/simulation/matrixRunner";
import { benchmarkAggregator } from "../domains/simulation/benchmarkAggregator";
import { simulationSpecService } from "../domains/simulation/specService";
import { judgeCalibrationEngine, type CalibrationDataPoint } from "../domains/evaluation/judgeCalibration";
import { discriminativePowerAnalyzer } from "../domains/evaluation/discriminativePower";

const router = Router();
const savedBenchmarks = new Map<string, ComprehensiveBenchmarkReport>();

// POST /v1/benchmarks/run — Run Multi-Agent Comparative Benchmark
router.post("/v1/benchmarks/run", async (req, res) => {
  try {
    const { specIds, specs: inlineSpecs, targetAgents, repetitions, baseSeed, calibrationData } = req.body || {};

    const resolvedSpecs: SimulationSpec[] = [];
    if (Array.isArray(specIds)) {
      for (const id of specIds) {
        const s = simulationSpecService.getSpec(id);
        if (s) resolvedSpecs.push(s);
      }
    }
    if (Array.isArray(inlineSpecs)) {
      resolvedSpecs.push(...inlineSpecs);
    }

    if (resolvedSpecs.length === 0) {
      res.status(400).json({ error: "At least one valid SimulationSpec is required for benchmarking" });
      return;
    }

    if (!Array.isArray(targetAgents) || targetAgents.length < 2) {
      res.status(400).json({ error: "At least 2 target agents are required for comparative benchmarking" });
      return;
    }

    const matrixResult = await simulationMatrixRunner.runMatrix({
      specs: resolvedSpecs,
      targetAgents: targetAgents as SimulationActorSpec[],
      repetitions: repetitions ?? 1,
      baseSeed: baseSeed ?? 42,
    });

    const calibrationReport = Array.isArray(calibrationData)
      ? judgeCalibrationEngine.calibrate(`calib_${Date.now()}`, calibrationData as CalibrationDataPoint[])
      : undefined;

    const report = benchmarkAggregator.aggregate(matrixResult, calibrationReport);
    savedBenchmarks.set(report.benchmarkId, report);

    res.status(201).json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Benchmark execution failed";
    res.status(500).json({ error: message });
  }
});

// POST /v1/evaluations/calibrate — Calibrate LLM Judge against human expert data
router.post("/v1/evaluations/calibrate", (req, res) => {
  try {
    const { calibrationSetId, dataPoints } = req.body || {};
    if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
      res.status(400).json({ error: "dataPoints array with expert ratings is required" });
      return;
    }
    const report = judgeCalibrationEngine.calibrate(
      calibrationSetId ?? `calib_${Date.now()}`,
      dataPoints as CalibrationDataPoint[]
    );
    res.status(200).json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calibration failed";
    res.status(500).json({ error: message });
  }
});

// GET /v1/benchmarks/:id — Get Benchmark Report
router.get("/v1/benchmarks/:id", (req, res) => {
  const report = savedBenchmarks.get(req.params.id);
  if (!report) {
    res.status(404).json({ error: `Benchmark report "${req.params.id}" not found` });
    return;
  }
  res.json(report);
});

// GET /v1/benchmarks — List Benchmark Reports
router.get("/v1/benchmarks", (_req, res) => {
  res.json(Array.from(savedBenchmarks.values()));
});

export default router;
