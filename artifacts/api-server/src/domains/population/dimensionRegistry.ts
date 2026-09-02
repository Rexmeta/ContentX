import type { DimensionDefinition } from "@workspace/simulation-contract";

export class DimensionRegistry {
  private static dimensions: Map<string, DimensionDefinition> = new Map([
    [
      "frustration",
      {
        id: "frustration",
        name: "Frustration Level",
        description: "Initial irritation and emotional agitation regarding the issue.",
        min: 0.0,
        max: 1.0,
        defaultValue: 0.5,
        boundaryThresholds: [0.3, 0.7, 0.85],
      },
    ],
    [
      "patience",
      {
        id: "patience",
        name: "Patience",
        description: "Tolerance for multi-turn troubleshooting before demanding escalation.",
        min: 0.0,
        max: 1.0,
        defaultValue: 0.5,
        boundaryThresholds: [0.2, 0.5, 0.8],
      },
    ],
    [
      "assertiveness",
      {
        id: "assertiveness",
        name: "Assertiveness",
        description: "Tendency to aggressively press demands and reject concessions.",
        min: 0.0,
        max: 1.0,
        defaultValue: 0.5,
        boundaryThresholds: [0.3, 0.7],
      },
    ],
    [
      "trust",
      {
        id: "trust",
        name: "Trust in Company",
        description: "Baseline trust and loyalty towards the company or brand.",
        min: 0.0,
        max: 1.0,
        defaultValue: 0.5,
        boundaryThresholds: [0.2, 0.6],
      },
    ],
    [
      "policy_awareness",
      {
        id: "policy_awareness",
        name: "Policy Awareness",
        description: "Familiarity with refund windows, warranty terms, and legal rights.",
        min: 0.0,
        max: 1.0,
        defaultValue: 0.3,
        boundaryThresholds: [0.5, 0.8],
      },
    ],
    [
      "price_sensitivity",
      {
        id: "price_sensitivity",
        name: "Price Sensitivity",
        description: "Importance of full monetary refund vs non-cash voucher alternatives.",
        min: 0.0,
        max: 1.0,
        defaultValue: 0.6,
        boundaryThresholds: [0.4, 0.8],
      },
    ],
  ]);

  static list(): DimensionDefinition[] {
    return Array.from(this.dimensions.values());
  }

  static get(id: string): DimensionDefinition | undefined {
    return this.dimensions.get(id);
  }

  static register(dimension: DimensionDefinition): void {
    this.dimensions.set(dimension.id, dimension);
  }
}
