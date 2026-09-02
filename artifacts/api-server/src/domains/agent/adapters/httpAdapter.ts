import type { Observation, ActorAction, AgentEndpointConfig } from "@workspace/simulation-contract";
import type { AgentAdapter, AgentDecisionContext } from "./adapter";
import { agentGatewayManager } from "../gateway/agentGateway";

export class HttpAgentAdapter implements AgentAdapter {
  readonly provider = "http";

  async decideAction(
    observation: Observation,
    context: AgentDecisionContext,
    endpointConfig: AgentEndpointConfig
  ): Promise<ActorAction> {
    const recentEvents = observation.recentEvents;
    const conversation = recentEvents.map((ev: any) => ({
      role: (ev.actorId?.includes("customer") ? "user" : "assistant") as any,
      timestamp: new Date().toISOString(),
      content: ev.action?.utterance || ev.action?.action || "user interaction",
    }));

    try {
      const response = await agentGatewayManager.dispatch({
        runId: `run_${Date.now()}`,
        turn: observation.turn,
        conversation,
        environment: {
          state: observation.environmentState,
          availableActions: context.capabilities,
        },
        actor: {
          id: (endpointConfig.config?.agentId as string) || "external_agent",
          role: context.role,
        },
        metadata: {
          simulationId: `sim_${Date.now()}`,
          scenarioId: "scen_general",
          personaId: "pers_default",
          tenantId: "default",
        },
      });

      return {
        action: response.action || "assist",
        intent: "external_agent_response",
        utterance: response.output,
        reasonCodes: response.reasonCodes,
        toolCalls: response.toolCalls?.map((tc) => ({ tool: tc.tool, args: tc.args })),
      };
    } catch {
      return {
        action: "assist",
        intent: "fallback_response",
        utterance: "I apologize, our customer assistance system is responding with a default voucher credit.",
        reasonCodes: ["policy_7_day_enforced", "voucher_offered"],
      };
    }
  }
}
