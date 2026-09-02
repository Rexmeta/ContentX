import { z } from "zod";

export const AgentMessageRoleSchema = z.enum(["system", "user", "assistant", "tool", "environment"]);
export type AgentMessageRole = z.infer<typeof AgentMessageRoleSchema>;

export const AgentMessageSchema = z.object({
  role: AgentMessageRoleSchema,
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()).default({}),
});
export type AgentToolDefinition = z.infer<typeof AgentToolDefinitionSchema>;

export const AgentToolCallSchema = z.object({
  id: z.string(),
  tool: z.string(),
  args: z.record(z.unknown()),
});
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;

export const AgentRequestSchema = z.object({
  runId: z.string(),
  turn: z.number().int().positive(),
  conversation: z.array(AgentMessageSchema),
  environment: z.object({
    state: z.record(z.unknown()).default({}),
    availableActions: z.array(z.string()).default([]),
  }),
  actor: z.object({
    id: z.string(),
    role: z.string(),
  }),
  tools: z.array(AgentToolDefinitionSchema).optional(),
  metadata: z.object({
    simulationId: z.string(),
    scenarioId: z.string(),
    personaId: z.string(),
    tenantId: z.string().default("default"),
  }),
});
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export const AgentResponseSchema = z.object({
  output: z.string(),
  action: z.string().optional(),
  reasonCodes: z.array(z.string()).default([]),
  toolCalls: z.array(AgentToolCallSchema).optional(),
  metadata: z.object({
    latencyMs: z.number().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    model: z.string().optional(),
    provider: z.string().optional(),
  }).optional(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export const AgentCapabilitiesSchema = z.object({
  supportsToolCalling: z.boolean().default(false),
  supportsMultiTurn: z.boolean().default(true),
  supportsStreaming: z.boolean().default(false),
  maxContextTokens: z.number().int().default(8192),
  supportedProtocols: z.array(z.enum(["http", "mcp", "sdk", "webhook"])).default(["http"]),
});
export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;

export const AgentHealthSchema = z.object({
  status: z.enum(["healthy", "degraded", "unreachable"]),
  latencyMs: z.number().nonnegative(),
  checkedAt: z.string(),
  details: z.string().optional(),
});
export type AgentHealth = z.infer<typeof AgentHealthSchema>;

export const ExternalAgentRegistrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default("1.0.0"),
  tenantId: z.string().default("default"),
  protocol: z.enum(["http", "mcp", "sdk", "webhook"]),
  endpointUrl: z.string().optional(),
  authConfig: z.object({
    type: z.enum(["bearer", "api_key", "hmac", "none"]).default("none"),
    secretToken: z.string().optional(),
    headerName: z.string().optional(),
  }).default({ type: "none" }),
  configurationHash: z.string(),
  capabilities: AgentCapabilitiesSchema.default({}),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type ExternalAgentRegistration = z.infer<typeof ExternalAgentRegistrationSchema>;

export const ContractCheckItemSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  latencyMs: z.number(),
  error: z.string().optional(),
});
export type ContractCheckItem = z.infer<typeof ContractCheckItemSchema>;

export const AgentContractCheckResultSchema = z.object({
  agentId: z.string(),
  version: z.string(),
  isReadyForBenchmarking: z.boolean(),
  passedChecksCount: z.number().int(),
  totalChecksCount: z.number().int(),
  checks: z.array(ContractCheckItemSchema),
  checkedAt: z.string(),
});
export type AgentContractCheckResult = z.infer<typeof AgentContractCheckResultSchema>;
