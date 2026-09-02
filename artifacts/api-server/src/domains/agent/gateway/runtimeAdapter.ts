import type {
  AgentEndpointConfig,
  AgentRequest,
  AgentResponse,
  ActorAction,
  Observation,
} from "@workspace/simulation-contract";
import type { AgentAdapter, AgentDecisionContext } from "../adapters/adapter";
import { agentGatewayManager } from "./agentGateway";

/**
 * Runtime bridge for registered external agents. Keeping this separate from
 * the HTTP adapter means MCP and SDK registrations use the same simulation
 * contract without pretending they are HTTP providers.
 */
export class GatewayRuntimeAdapter implements AgentAdapter {
  constructor(public readonly provider: string) {}

  async decideAction(
    observation: Observation,
    context: AgentDecisionContext,
    endpointConfig: AgentEndpointConfig,
  ): Promise<ActorAction> {
    const recentEvents = observation.recentEvents;
    const conversation = recentEvents.map((event) => {
      const ev = event as {
        actorId?: string;
        action?: { utterance?: string; action?: string };
      };
      return {
        role: (ev.actorId?.includes("customer") ? "user" : "assistant") as
          | "user"
          | "assistant",
        timestamp: new Date().toISOString(),
        content: ev.action?.utterance || ev.action?.action || "user interaction",
      };
    });

    const request: AgentRequest = {
      runId: `runtime_${Date.now()}`,
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
        scenarioId: (endpointConfig.config?.scenarioId as string) || "reference_customer_support_v1",
        personaId: (endpointConfig.config?.personaId as string) || "reference_persona",
        tenantId: (endpointConfig.config?.tenantId as string) || "default",
      },
    };

    const response = await agentGatewayManager.dispatch(request);
    return responseToAction(response);
  }
}

function responseToAction(response: AgentResponse): ActorAction {
  return {
    action: response.action || "assist",
    intent: "external_agent_response",
    utterance: response.output,
    reasonCodes: response.reasonCodes,
    toolCalls: response.toolCalls?.map((call) => ({
      tool: call.tool,
      args: call.args,
    })),
  };
}
