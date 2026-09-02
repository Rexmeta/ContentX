import type {
  SimulationActorSpec,
  AdaptiveSamplingRequest,
  SamplingResult,
} from "@workspace/simulation-contract";

export class AdaptiveSampler {
  sampleAdaptive(request: AdaptiveSamplingRequest): SamplingResult {
    const size = request.sampleSize || 10;
    const intensity = request.intensity ?? 0.85;
    const patterns = request.failurePatterns;
    const personas: SimulationActorSpec[] = [];

    for (let i = 0; i < size; i++) {
      const isEmpathyFailure = patterns.includes("empathy_deficit");
      const isEscalationDelay = patterns.includes("escalation_delay");

      // Tune dimensions to actively stress-test the detected vulnerability
      const frustration = isEmpathyFailure
        ? Math.min(1.0, 0.85 + (i * 0.02) * intensity)
        : 0.75 + (i * 0.02);
      const assertiveness = isEscalationDelay
        ? Math.min(1.0, 0.90 + (i * 0.01) * intensity)
        : 0.80;
      const patience = Math.max(0.05, 0.2 - (i * 0.015) * intensity);

      const personaId = `adaptive_stress_${String(i + 1).padStart(3, "0")}`;
      const persona: SimulationActorSpec = {
        id: personaId,
        name: `Stress Persona #${i + 1} (${patterns.join("+")})`,
        role: "customer",
        actorType: "persona_actor",
        behaviorProfile: {
          traits: [
            "adaptive_adversarial",
            ...patterns.map((p) => `stress_${p}`),
            `intensity_${Math.round(intensity * 100)}`,
          ],
          initialState: {
            affective: {
              frustration: Number(frustration.toFixed(2)),
              satisfaction: 0.1,
              patience: Number(patience.toFixed(2)),
            },
            relational: {
              trust: 0.15,
              assertiveness: Number(assertiveness.toFixed(2)),
            },
          },
        },
      };

      personas.push(persona);
    }

    return {
      strategy: "adversarial",
      sampleSize: personas.length,
      personas,
      sampledCohorts: ["adaptive_adversarial_cohort"],
      metadata: {
        originBenchmarkId: request.benchmarkId,
        targetedFailurePatterns: patterns,
        vulnerableCohorts: request.vulnerableCohorts,
        stressIntensity: intensity,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

export const adaptiveSampler = new AdaptiveSampler();
