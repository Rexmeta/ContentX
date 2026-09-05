import { describe, expect, it, vi } from "vitest";
import {
  RoleplayXClientError,
  createRoleplayXClient,
  roleplayXIdempotencyKey,
} from "../roleplayxClient";

const payload = { schemaVersion: "AssessmentScenarioPackageV1" };

describe("RoleplayX client", () => {
  it("sends credentials only as an authorization header and forwards its idempotency key", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ valid: true }), { status: 200 }));
    const client = createRoleplayXClient({ baseUrl: "https://roleplay.example/", apiKey: "secret", fetch });

    await client.validate(payload, "fixed-key");

    expect(fetch).toHaveBeenCalledWith(
      "https://roleplay.example/api/content/import/validate",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer secret",
          "idempotency-key": "fixed-key",
        }),
      }),
    );
    expect((fetch.mock.calls[0]?.[1] as RequestInit).body).not.toContain("secret");
  });

  it("retries only retryable server failures with a bounded count", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "retry" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid: true }), { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createRoleplayXClient({ baseUrl: "https://roleplay.example", apiKey: "secret", fetch, sleep });

    await expect(client.validate(payload, "key")).resolves.toMatchObject({ valid: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("maps authentication responses without retrying", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "no" }), { status: 401 }));
    const client = createRoleplayXClient({ baseUrl: "https://roleplay.example", apiKey: "secret", fetch });

    await expect(client.import(payload, "key")).rejects.toMatchObject({ category: "auth" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("makes stable target idempotency keys", () => {
    const input = { packageId: "package-1", version: 2, organizationId: "org-1", category: "training" };
    expect(roleplayXIdempotencyKey(input)).toBe(roleplayXIdempotencyKey(input));
    expect(roleplayXIdempotencyKey(input)).not.toBe(roleplayXIdempotencyKey({ ...input, version: 3 }));
  });
});