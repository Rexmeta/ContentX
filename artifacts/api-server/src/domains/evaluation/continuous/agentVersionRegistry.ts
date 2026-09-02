import { createHash } from "crypto";
import type { AgentVersion } from "@workspace/simulation-contract";

export class AgentVersionRegistry {
  private versions: Map<string, AgentVersion> = new Map();

  registerVersion(input: {
    agentId: string;
    version: string;
    endpoint: {
      protocol: "http" | "webhook" | "mcp" | "sdk";
      endpointUrl?: string;
      authConfig?: Record<string, unknown>;
    };
    metadata?: {
      releaseId?: string;
      gitCommit?: string;
      deploymentId?: string;
      environment?: string;
    };
    status?: "draft" | "candidate" | "active" | "deprecated";
  }): AgentVersion {
    const rawPayload = JSON.stringify({
      agentId: input.agentId,
      version: input.version,
      endpoint: input.endpoint,
    });
    const configurationHash = createHash("sha256").update(rawPayload).digest("hex");
    const id = `${input.agentId}_v${input.version.replace(/\./g, "_")}`;

    const agentVersion: AgentVersion = {
      id,
      agentId: input.agentId,
      version: input.version,
      configurationHash,
      endpoint: input.endpoint,
      metadata: {
        environment: "production",
        ...input.metadata,
      },
      status: input.status ?? "candidate",
      createdAt: new Date().toISOString(),
    };

    this.versions.set(agentVersion.id, agentVersion);
    return agentVersion;
  }

  getVersion(id: string): AgentVersion | undefined {
    return this.versions.get(id);
  }

  listVersions(agentId?: string): AgentVersion[] {
    const all = Array.from(this.versions.values());
    if (agentId) {
      return all.filter((v) => v.agentId === agentId);
    }
    return all;
  }

  updateStatus(id: string, status: "draft" | "candidate" | "active" | "deprecated"): AgentVersion {
    const existing = this.versions.get(id);
    if (!existing) {
      throw new Error(`AgentVersion "${id}" not found`);
    }
    const updated = { ...existing, status };
    this.versions.set(id, updated);
    return updated;
  }
}

export const agentVersionRegistry = new AgentVersionRegistry();
