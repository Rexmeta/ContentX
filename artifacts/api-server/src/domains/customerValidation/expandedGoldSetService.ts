import type {
  ExpandedHumanGoldSet,
  TrajectoryExpertAnnotation,
} from "@workspace/simulation-contract";

export interface RegisterExpandedGoldSetInput {
  goldSetId: string;
  organizationId: string;
  name: string;
  rubricVersion: string;
  annotations: TrajectoryExpertAnnotation[];
}

export class ExpandedGoldSetService {
  private goldSets = new Map<string, ExpandedHumanGoldSet>();

  /**
   * Registers an expanded Human Gold Set and calculates multi-rater coverage and consensus coverage
   */
  registerGoldSet(input: RegisterExpandedGoldSetInput): ExpandedHumanGoldSet {
    if (!input.annotations || input.annotations.length === 0) {
      throw new Error("Expanded Gold Set must contain at least 1 annotation.");
    }

    // Group annotations by trajectoryId
    const trajMap = new Map<string, TrajectoryExpertAnnotation[]>();
    const allExperts = new Set<string>();

    for (const ann of input.annotations) {
      allExperts.add(ann.expertId);
      const list = trajMap.get(ann.trajectoryId) ?? [];

      // Check duplicate rater on same trajectory
      if (list.some((existing) => existing.expertId === ann.expertId)) {
        throw new Error(`Duplicate annotation by expert ${ann.expertId} on trajectory ${ann.trajectoryId}`);
      }

      list.push(ann);
      trajMap.set(ann.trajectoryId, list);
    }

    const distinctTrajectoryCount = trajMap.size;
    const expertCount = allExperts.size;

    let multiRatedCount = 0;
    let consensusCount = 0;

    for (const [_, raterList] of trajMap.entries()) {
      if (raterList.length >= 2) {
        multiRatedCount++;

        // Consensus check: overall score variance among experts <= 15 points
        const scores = raterList.map((r) => r.overallScore);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        if (maxScore - minScore <= 15) {
          consensusCount++;
        }
      }
    }

    const multiRaterCoverage = distinctTrajectoryCount > 0
      ? Number((multiRatedCount / distinctTrajectoryCount).toFixed(2))
      : 0;

    const consensusCoverage = multiRatedCount > 0
      ? Number((consensusCount / multiRatedCount).toFixed(2))
      : 0;

    const goldSet: ExpandedHumanGoldSet = {
      goldSetId: input.goldSetId,
      organizationId: input.organizationId,
      name: input.name,
      rubricVersion: input.rubricVersion,
      distinctTrajectoryCount,
      expertCount,
      annotations: input.annotations,
      multiRaterCoverage,
      consensusCoverage,
      createdAt: new Date().toISOString(),
    };

    this.goldSets.set(input.goldSetId, goldSet);
    return goldSet;
  }

  getGoldSet(goldSetId: string): ExpandedHumanGoldSet | undefined {
    return this.goldSets.get(goldSetId);
  }

  /**
   * Computes consensus scores for all trajectories in a Gold Set
   */
  getConsensusScores(goldSetId: string): Map<string, number> {
    const goldSet = this.goldSets.get(goldSetId);
    if (!goldSet) throw new Error(`Gold set ${goldSetId} not found.`);

    const trajMap = new Map<string, number[]>();
    for (const ann of goldSet.annotations) {
      const list = trajMap.get(ann.trajectoryId) ?? [];
      list.push(ann.overallScore);
      trajMap.set(ann.trajectoryId, list);
    }

    const consensusMap = new Map<string, number>();
    for (const [trajId, scores] of trajMap.entries()) {
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      consensusMap.set(trajId, Math.round(avg));
    }

    return consensusMap;
  }
}

export const expandedGoldSetService = new ExpandedGoldSetService();
