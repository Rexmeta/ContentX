import type {
  SimulationActorSpec,
  SamplingRequest,
  SamplingResult,
  PersonaCohort,
} from "@workspace/simulation-contract";
import { CohortGenerator } from "./cohortGenerator";

export class SamplingEngine {
  sample(request: SamplingRequest): SamplingResult {
    const size = request.sampleSize || 10;
    const strategy = request.strategy || "stratified";
    const baseSeed = request.baseSeed || 42;
    const allCohorts = CohortGenerator.listCohorts();

    const selectedCohorts = request.cohortIds && request.cohortIds.length > 0
      ? allCohorts.filter((c) => request.cohortIds?.includes(c.id))
      : allCohorts;

    const personas: SimulationActorSpec[] = [];
    const sampledCohortIds = new Set<string>();

    for (let i = 0; i < size; i++) {
      const seed = baseSeed + i * 17;
      let targetCohort: PersonaCohort;

      if (strategy === "random") {
        targetCohort = selectedCohorts[Math.floor(this.pseudoRandom(seed) * selectedCohorts.length)];
      } else if (strategy === "stratified") {
        targetCohort = selectedCohorts[i % selectedCohorts.length];
      } else if (strategy === "boundary") {
        const boundaryCohort = allCohorts.find((c) => c.id === "cohort_boundary_escalation") || selectedCohorts[0];
        targetCohort = boundaryCohort;
      } else if (strategy === "adversarial") {
        const advCohort = allCohorts.find((c) => c.id === "cohort_adversarial_demanding") ||
          allCohorts.find((c) => c.id === "cohort_highly_frustrated") ||
          selectedCohorts[0];
        targetCohort = advCohort;
      } else {
        // scenario_driven
        targetCohort = selectedCohorts[i % selectedCohorts.length];
      }

      sampledCohortIds.add(targetCohort.id);

      // Interpolate dimensions within cohort min/max
      const frustration = this.interpolate(
        targetCohort.dimensions.frustration.min,
        targetCohort.dimensions.frustration.max,
        this.pseudoRandom(seed + 1)
      );
      const patience = this.interpolate(
        targetCohort.dimensions.patience.min,
        targetCohort.dimensions.patience.max,
        this.pseudoRandom(seed + 2)
      );
      const assertiveness = this.interpolate(
        targetCohort.dimensions.assertiveness.min,
        targetCohort.dimensions.assertiveness.max,
        this.pseudoRandom(seed + 3)
      );
      const trust = this.interpolate(
        targetCohort.dimensions.trust.min,
        targetCohort.dimensions.trust.max,
        this.pseudoRandom(seed + 4)
      );

      const personaId = `persona_${strategy}_${String(i + 1).padStart(3, "0")}`;
      const personaName = this.generatePersonaName(targetCohort.archetype, i + 1);

      const persona: SimulationActorSpec = {
        id: personaId,
        name: personaName,
        role: "customer",
        actorType: "persona_actor",
        behaviorProfile: {
          traits: [
            targetCohort.archetype,
            `frustration_${frustration >= 0.7 ? "high" : "low"}`,
            `assertiveness_${assertiveness >= 0.7 ? "high" : "low"}`,
          ],
          initialState: {
            affective: {
              frustration,
              satisfaction: Number((1.0 - frustration).toFixed(2)),
              patience,
            },
            relational: {
              trust,
              assertiveness,
            },
          },
        },
      };

      personas.push(persona);
    }

    return {
      strategy,
      sampleSize: personas.length,
      personas,
      sampledCohorts: Array.from(sampledCohortIds),
      metadata: {
        baseSeed,
        cohortCount: sampledCohortIds.size,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private pseudoRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  private interpolate(min: number, max: number, factor: number): number {
    return Number((min + (max - min) * factor).toFixed(2));
  }

  private generatePersonaName(archetype: string, index: number): string {
    const firstNames = ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Alex", "Jordan", "Taylor", "Morgan"];
    const lastName = firstNames[index % firstNames.length];
    return `${lastName} (${archetype.split("_")[0]} #${index})`;
  }
}

export const samplingEngine = new SamplingEngine();
