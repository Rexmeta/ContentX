import type { Observation, ActorAction, AgentEndpointConfig } from "@workspace/simulation-contract";
import type { AgentAdapter, AgentDecisionContext } from "./adapter";
import { MockAgentAdapter } from "./mockAdapter";

export class AnthropicAgentAdapter implements AgentAdapter {
  readonly provider = "anthropic";
  private fallbackMock = new MockAgentAdapter();

  async decideAction(
    observation: Observation,
    context: AgentDecisionContext,
    endpointConfig: AgentEndpointConfig
  ): Promise<ActorAction> {
    return this.fallbackMock.decideAction(observation, context, {
      provider: "mock",
      config: { profile: "claude-profile", ...endpointConfig.config },
    });
  }
}
