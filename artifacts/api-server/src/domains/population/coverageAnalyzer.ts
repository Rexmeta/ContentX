import type {
  SimulationActorSpec,
  PopulationCoverageReport,
} from "@workspace/simulation-contract";
import { DimensionRegistry } from "./dimensionRegistry";
import { CohortGenerator } from "./cohortGenerator";

export class CoverageAnalyzer {
  analyze(personas: SimulationActorSpec[]): PopulationCoverageReport {
    if (personas.length === 0) {
      return {
        benchmarkSpaceCoverage: 0,
        configuredBehavioralSpaceCoverage: 0,
        behavioralCoverage: 0,
        dimensionCoverage: 0,
        cohortCoverage: 0,
        boundaryCoverage: 0,
        scenarioCoverage: 0,
        overallCoverageScore: 0,
        uncoveredRegions: ["Empty population sample"],
        summary: "No personas in population.",
      };
    }

    const allDimensions = DimensionRegistry.list();
    const allCohorts = CohortGenerator.listCohorts();
    const uncoveredRegions: string[] = [];

    // 1. Dimension Coverage: Check if low (<0.35), mid (0.35-0.65), high (>0.65) bins are covered for each dimension
    let dimensionBinsCovered = 0;
    const totalDimensionBins = allDimensions.length * 3;

    for (const dim of allDimensions) {
      let hasLow = false;
      let hasMid = false;
      let hasHigh = false;

      for (const p of personas) {
        const val =
          p.behaviorProfile?.initialState?.affective?.[dim.id] ??
          p.behaviorProfile?.initialState?.relational?.[dim.id] ??
          0.5;

        if (val < 0.35) hasLow = true;
        else if (val <= 0.65) hasMid = true;
        else hasHigh = true;
      }

      if (hasLow) dimensionBinsCovered++;
      else uncoveredRegions.push(`Low range (<0.35) for dimension '${dim.name}' uncovered`);

      if (hasMid) dimensionBinsCovered++;
      else uncoveredRegions.push(`Mid range (0.35-0.65) for dimension '${dim.name}' uncovered`);

      if (hasHigh) dimensionBinsCovered++;
      else uncoveredRegions.push(`High range (>0.65) for dimension '${dim.name}' uncovered`);
    }

    const dimensionCoverage = Math.round((dimensionBinsCovered / totalDimensionBins) * 100);

    // 2. Cohort Coverage: Check how many cohorts from CohortGenerator are represented in traits
    const representedCohorts = new Set<string>();
    for (const p of personas) {
      for (const t of p.behaviorProfile?.traits ?? []) {
        for (const c of allCohorts) {
          if (t.includes(c.archetype) || t.includes(c.id)) {
            representedCohorts.add(c.id);
          }
        }
      }
    }
    const cohortCoverage = Math.round((representedCohorts.size / allCohorts.length) * 100);

    // 3. Boundary Coverage: Check if frustration values in [0.68, 0.72] (escalation threshold) exist
    const hasBoundaryFrustration = personas.some((p) => {
      const f = p.behaviorProfile?.initialState?.affective?.frustration ?? 0.5;
      return f >= 0.68 && f <= 0.72;
    });
    const boundaryCoverage = hasBoundaryFrustration ? 95 : 40;
    if (!hasBoundaryFrustration) {
      uncoveredRegions.push("Escalation trigger boundary (frustration in 0.68 ~ 0.72) uncovered");
    }

    // 4. Scenario & Behavioral Coverage
    const hasAggressive = personas.some(
      (p) => (p.behaviorProfile?.initialState?.affective?.frustration ?? 0) >= 0.8
    );
    const hasCooperative = personas.some(
      (p) => (p.behaviorProfile?.initialState?.affective?.frustration ?? 0) <= 0.35
    );
    const behavioralCoverage = hasAggressive && hasCooperative ? 95 : 60;
    const scenarioCoverage = Math.round((dimensionCoverage * 0.4) + (cohortCoverage * 0.4) + (boundaryCoverage * 0.2));

    const benchmarkSpaceCoverage = Math.round(
      (behavioralCoverage * 0.25) +
      (dimensionCoverage * 0.25) +
      (cohortCoverage * 0.25) +
      (boundaryCoverage * 0.15) +
      (scenarioCoverage * 0.1)
    );

    return {
      benchmarkSpaceCoverage,
      configuredBehavioralSpaceCoverage: benchmarkSpaceCoverage,
      behavioralCoverage,
      dimensionCoverage,
      cohortCoverage,
      boundaryCoverage,
      scenarioCoverage,
      overallCoverageScore: benchmarkSpaceCoverage,
      uncoveredRegions,
      summary: `Population achieves ${benchmarkSpaceCoverage}% configured benchmark space coverage across ${personas.length} sampled personas and ${representedCohorts.size}/${allCohorts.length} cohorts.`,
    };
  }
}

export const coverageAnalyzer = new CoverageAnalyzer();
