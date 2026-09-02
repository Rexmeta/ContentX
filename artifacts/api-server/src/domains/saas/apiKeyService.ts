import { createHash, randomBytes } from "crypto";
import type { ApiKey, ApiKeyScope } from "@workspace/simulation-contract";

export class ApiKeyService {
  private apiKeys: Map<string, ApiKey> = new Map(); // keyHash -> ApiKey

  generateApiKey(input: {
    organizationId: string;
    projectId?: string;
    name: string;
    scopes: ApiKeyScope[];
  }): { apiKey: ApiKey; rawSecretToken: string } {
    const rawSecretToken = `rpx_live_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawSecretToken).digest("hex");
    const keyPrefix = rawSecretToken.substring(0, 16);

    const apiKey: ApiKey = {
      id: `key_${Date.now()}`,
      organizationId: input.organizationId,
      projectId: input.projectId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: input.scopes,
      createdAt: new Date().toISOString(),
    };

    this.apiKeys.set(keyHash, apiKey);
    return { apiKey, rawSecretToken };
  }

  verifyApiKey(rawSecretToken: string, requiredScope?: ApiKeyScope): { valid: boolean; apiKey?: ApiKey } {
    const keyHash = createHash("sha256").update(rawSecretToken).digest("hex");
    const apiKey = this.apiKeys.get(keyHash);
    if (!apiKey) return { valid: false };

    if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
      return { valid: false, apiKey };
    }

    apiKey.lastUsedAt = new Date().toISOString();
    return { valid: true, apiKey };
  }

  listApiKeys(organizationId: string): ApiKey[] {
    return Array.from(this.apiKeys.values()).filter((k) => k.organizationId === organizationId);
  }
}

export const apiKeyService = new ApiKeyService();
