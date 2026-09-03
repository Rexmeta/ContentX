# P9.1: 4-Way Telemetry Segregation & Attribution Specification

## 1. Problem Statement & Principles

In complex multi-turn evaluations of external AI agents, conflating platform orchestration latency with external inference latency or judge model evaluation costs creates inaccurate attribution.

P9.1 establishes four non-overlapping telemetry namespaces with zero cross-bleed:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Platform Telemetry (RoleplayX Core Infrastructure)      │
│    • Orchestration Latency (p50, p95, p99)                  │
│    • Evaluation Execution Latency (p50, p95, p99)           │
│    • Simulation Engine Throughput (sims/sec)                │
│    • Platform Infrastructure Cost (USD)                     │
├─────────────────────────────────────────────────────────────┤
│ 2. External Customer Agent Telemetry (Client VPC / Server)  │
│    • Agent Model Inference Latency (p50, p95, p99)          │
│    • Network Transport Roundtrip Latency (p50, p95, p99)    │
│    • Customer Tool Execution Latency (p50, p95, p99)        │
│    • Agent Timeout & HTTP Error Rates                       │
├─────────────────────────────────────────────────────────────┤
│ 3. Evaluator Quality & Cost (Multi-Layer Judge System)      │
│    • Human Gold Set Alignment (Pearson r, Cohen's kappa)    │
│    • Mean Absolute Error (MAE) & Mean Bias                  │
│    • Judge LLM Inference Latency (p50, p95, p99)            │
│    • Judge LLM Inference Cost (USD)                         │
│    • Confusion Matrix (TP, TN, FP, FN, Precision, Recall)   │
├─────────────────────────────────────────────────────────────┤
│ 4. Customer Business Value & Defect Remediation             │
│    • Discovered Failure Modes Count                         │
│    • Customer Confirmed Failures Count                      │
│    • Confirmation Rate (%)                                  │
│    • Remediated Failures Count                              │
│    • Target Defect Recurrence Rate on Retest (0.0%)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Telemetry Schema

```typescript
export interface SegregatedTelemetryReport {
  platformTelemetry: {
    orchestrationLatencyMs: { p50: number; p95: number; p99: number };
    evaluationLatencyMs: { p50: number; p95: number; p99: number };
    throughputSimulationsPerSec: number;
    platformCostUSD: number;
  };
  agentTelemetry: {
    inferenceLatencyMs: { p50: number; p95: number; p99: number };
    networkTransportLatencyMs: { p50: number; p95: number; p99: number };
    toolExecutionLatencyMs: { p50: number; p95: number; p99: number };
    timeoutRate: number;
    httpErrorRate: number;
  };
  evaluatorQuality: {
    goldSetSampleSize: number;
    expertCount: number;
    multiRaterCoverage: number;
    consensusCoverage: number;
    pearsonR: number;
    cohensKappaJudgeVsHuman: number;
    mae: number;
    bias: number;
    judgeLatencyMs: { p50: number; p95: number; p99: number };
    judgeCostUSD: number;
    calibrationStatus: "CALIBRATED" | "PROVISIONAL" | "FAILED";
    confusionMatrix: ConfusionMatrix;
  };
  customerBusinessValue: {
    failuresDiscovered: number;
    failuresCustomerConfirmed: number;
    confirmationRate: number;
    failuresRemediatedInHardenedVersion: number;
    targetFailureRecurrenceRateOnRetest: number;
  };
}
```
