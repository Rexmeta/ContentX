import type { Observation, ActorAction, AgentEndpointConfig } from "@workspace/simulation-contract";

export interface AgentDecisionContext {
  systemPrompt?: string;
  role: string;
  name: string;
  capabilities: string[];
  maxTurns?: number;
}

/**
 * Universal Agent Adapter Interface:
 * Decouples external AI models and endpoints from the Simulation Runtime.
 * The Runtime interacts ONLY with this contract.
 */
export interface AgentAdapter {
  readonly provider: string;
  decideAction(
    observation: Observation,
    context: AgentDecisionContext,
    config: AgentEndpointConfig
  ): Promise<ActorAction>;
}
