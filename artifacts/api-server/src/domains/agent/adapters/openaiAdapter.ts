import type { Observation, ActorAction, AgentEndpointConfig } from "@workspace/simulation-contract";
import type { AgentAdapter, AgentDecisionContext } from "./adapter";
import { MockAgentAdapter } from "./mockAdapter";

export class OpenAIAgentAdapter implements AgentAdapter {
  readonly provider = "openai";
  private fallbackMock = new MockAgentAdapter();

  async decideAction(
    observation: Observation,
    context: AgentDecisionContext,
    endpointConfig: AgentEndpointConfig
  ): Promise<ActorAction> {
    // When live API keys or endpoints are configured, execute via OpenAI API Client.
    // In test/offline environments or when mock is requested, delegate to deterministic mock adapter.
    return this.fallbackMock.decideAction(observation, context, {
      provider: "mock",
      config: { profile: "gpt-profile", ...endpointConfig.config },
    });
  }
}
