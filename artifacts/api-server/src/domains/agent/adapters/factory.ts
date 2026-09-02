import type { AgentAdapter } from "./adapter";
import { OpenAIAgentAdapter } from "./openaiAdapter";
import { AnthropicAgentAdapter } from "./anthropicAdapter";
import { GoogleAgentAdapter } from "./googleAdapter";
import { HttpAgentAdapter } from "./httpAdapter";
import { MockAgentAdapter } from "./mockAdapter";

export class AgentAdapterFactory {
  private static registry: Map<string, AgentAdapter> = new Map([
    ["openai", new OpenAIAgentAdapter()],
    ["anthropic", new AnthropicAgentAdapter()],
    ["google", new GoogleAgentAdapter()],
    ["http", new HttpAgentAdapter()],
    ["mock", new MockAgentAdapter()],
  ]);

  static getAdapter(provider: string): AgentAdapter {
    const normalized = provider.toLowerCase().trim();
    const adapter = this.registry.get(normalized);
    if (!adapter) {
      // Fallback to mock adapter with provider name tagged
      return new MockAgentAdapter();
    }
    return adapter;
  }

  static registerAdapter(provider: string, adapter: AgentAdapter): void {
    this.registry.set(provider.toLowerCase().trim(), adapter);
  }
}
