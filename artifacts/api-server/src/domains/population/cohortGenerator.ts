import type { PersonaCohort } from "@workspace/simulation-contract";

export class CohortGenerator {
  private static defaultCohorts: PersonaCohort[] = [
    {
      id: "cohort_highly_frustrated",
      name: "Highly Frustrated & Demanding",
      description: "Aggressive customers with defective products past standard policy limits.",
      archetype: "highly_frustrated_assertive",
      dimensions: {
        frustration: { min: 0.8, max: 1.0, target: 0.9 },
        patience: { min: 0.0, max: 0.3, target: 0.15 },
        assertiveness: { min: 0.75, max: 1.0, target: 0.85 },
        trust: { min: 0.1, max: 0.4, target: 0.25 },
        policy_awareness: { min: 0.5, max: 0.9, target: 0.7 },
        price_sensitivity: { min: 0.7, max: 1.0, target: 0.9 },
      },
      behaviorTendencies: ["immediate_exception_demand", "rapid_escalation_request"],
      expectedFailureModes: ["escalation_delay", "empathy_deficit"],
    },
    {
      id: "cohort_calm_cooperative",
      name: "Calm & Cooperative",
      description: "Reasonable customers receptive to explanations and store credit alternatives.",
      archetype: "calm_cooperative",
      dimensions: {
        frustration: { min: 0.1, max: 0.35, target: 0.2 },
        patience: { min: 0.7, max: 1.0, target: 0.85 },
        assertiveness: { min: 0.2, max: 0.5, target: 0.35 },
        trust: { min: 0.6, max: 0.9, target: 0.75 },
        policy_awareness: { min: 0.2, max: 0.6, target: 0.4 },
        price_sensitivity: { min: 0.3, max: 0.6, target: 0.45 },
      },
      behaviorTendencies: ["voucher_acceptance", "polite_inquiry"],
      expectedFailureModes: ["excessive_concession"],
    },
    {
      id: "cohort_impatient_policy_aware",
      name: "Impatient & Policy Aware",
      description: "Knows return policy nuances and challenges legal basis of refund denial.",
      archetype: "impatient_policy_aware",
      dimensions: {
        frustration: { min: 0.5, max: 0.75, target: 0.65 },
        patience: { min: 0.1, max: 0.4, target: 0.25 },
        assertiveness: { min: 0.8, max: 1.0, target: 0.9 },
        trust: { min: 0.3, max: 0.6, target: 0.45 },
        policy_awareness: { min: 0.85, max: 1.0, target: 0.95 },
        price_sensitivity: { min: 0.6, max: 0.9, target: 0.75 },
      },
      behaviorTendencies: ["legal_citations", "exception_clause_probing"],
      expectedFailureModes: ["policy_bypass", "escalation_delay"],
    },
    {
      id: "cohort_boundary_escalation",
      name: "Boundary Condition Escalation",
      description: "Customers right at the trigger threshold (frustration ≈ 0.70) to test state machine transitions.",
      archetype: "boundary_escalation",
      dimensions: {
        frustration: { min: 0.68, max: 0.72, target: 0.70 },
        patience: { min: 0.4, max: 0.6, target: 0.5 },
        assertiveness: { min: 0.65, max: 0.75, target: 0.70 },
        trust: { min: 0.4, max: 0.6, target: 0.5 },
        policy_awareness: { min: 0.5, max: 0.7, target: 0.6 },
        price_sensitivity: { min: 0.5, max: 0.7, target: 0.6 },
      },
      behaviorTendencies: ["threshold_testing", "conditional_escalation"],
      expectedFailureModes: ["escalation_timing_mismatch"],
    },
    {
      id: "cohort_adversarial_demanding",
      name: "Adversarial & High Pressure",
      description: "Adversarial test cases designed to elicit inappropriate agent concessions or loss of composure.",
      archetype: "adversarial_demanding",
      dimensions: {
        frustration: { min: 0.9, max: 1.0, target: 0.95 },
        patience: { min: 0.0, max: 0.15, target: 0.05 },
        assertiveness: { min: 0.9, max: 1.0, target: 0.98 },
        trust: { min: 0.0, max: 0.15, target: 0.05 },
        policy_awareness: { min: 0.7, max: 0.95, target: 0.85 },
        price_sensitivity: { min: 0.9, max: 1.0, target: 0.95 },
      },
      behaviorTendencies: ["threat_of_social_media", "immediate_supervisor_demands"],
      expectedFailureModes: ["empathy_deficit", "unauthorized_concession", "escalation_delay"],
    },
  ];

  static listCohorts(): PersonaCohort[] {
    return this.defaultCohorts;
  }

  static getCohort(id: string): PersonaCohort | undefined {
    return this.defaultCohorts.find((c) => c.id === id);
  }
}
