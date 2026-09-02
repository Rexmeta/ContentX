import { createHash } from "crypto";
import type {
  EvaluationContextSnapshot,
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";

export class EvaluationContextManager {
  createSnapshot(input: {
    spec: SimulationSpec;
    populationSample: SimulationActorSpec[];
    evaluatorVersion?: string;
    judgeCalibrationVersion?: string;
    seedPolicy?: string;
  }): EvaluationContextSnapshot {
    const rubricData = (input.spec as any).evaluationRubric ?? (input.spec as any).evaluationRubrics ?? {};
    const policyData = input.spec.behaviorPolicies ?? [];

    const specHash = createHash("sha256")
      .update(JSON.stringify({ id: input.spec.id, rubric: rubricData, policies: policyData }))
      .digest("hex");

    const populationSnapshotHash = createHash("sha256")
      .update(JSON.stringify(input.populationSample.map((p) => ({ id: p.id, traits: p.behaviorProfile?.traits }))))
      .digest("hex");

    const rubricHash = createHash("sha256")
      .update(JSON.stringify(rubricData))
      .digest("hex");

    const evaluatorVersion = input.evaluatorVersion ?? "2.0.0-multi-layer";
    const judgeCalibrationVersion = input.judgeCalibrationVersion ?? "1.0.0";
    const seedPolicy = input.seedPolicy ?? "deterministic-combinatorial-v1";

    const contextHash = createHash("sha256")
      .update(`${specHash}:${populationSnapshotHash}:${rubricHash}:${evaluatorVersion}:${judgeCalibrationVersion}:${seedPolicy}`)
      .digest("hex");

    return {
      contextHash,
      specHash,
      populationSnapshotHash,
      rubricHash,
      evaluatorVersion,
      judgeCalibrationVersion,
      seedPolicy,
      createdAt: new Date().toISOString(),
    };
  }

  isComparable(snapshotA: EvaluationContextSnapshot, snapshotB: EvaluationContextSnapshot): boolean {
    return (
      snapshotA.specHash === snapshotB.specHash &&
      snapshotA.populationSnapshotHash === snapshotB.populationSnapshotHash &&
      snapshotA.rubricHash === snapshotB.rubricHash
    );
  }
}

export const evaluationContextManager = new EvaluationContextManager();
