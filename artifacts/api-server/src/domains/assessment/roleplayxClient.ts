import { z } from "zod";

export type RoleplayXErrorCategory =
  | "auth"
  | "permission"
  | "conflict"
  | "validation"
  | "server"
  | "network"
  | "timeout";

export class RoleplayXClientError extends Error {
  constructor(
    public readonly category: RoleplayXErrorCategory,
    message: string,
    public readonly status?: number,
    public readonly response?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RoleplayXClientError";
  }
}

export class RoleplayXClientConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleplayXClientConfigurationError";
  }
}

/**
 * The common response fields are deliberately constrained, while preserving
 * endpoint-specific fields for forward-compatible RoleplayX releases.
 */
const roleplayXResponseSchema = z
  .object({
    valid: z.boolean().optional(),
    accepted: z.boolean().optional(),
    success: z.boolean().optional(),
    message: z.string().optional(),
    errors: z.array(z.unknown()).optional(),
    diagnostics: z.array(z.unknown()).optional(),
    importId: z.string().optional(),
    id: z.string().optional(),
  })
  .passthrough()
  .refine(
    (response) =>
      response.valid !== undefined ||
      response.accepted !== undefined ||
      response.success !== undefined ||
      response.importId !== undefined ||
      response.id !== undefined ||
      response.errors !== undefined ||
      response.diagnostics !== undefined,
    "Response must contain a RoleplayX result field",
  );

export type RoleplayXResponse = z.infer<typeof roleplayXResponseSchema>;

export interface RoleplayXClient {
  validate(
    assessmentPackage: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<RoleplayXResponse>;
  import(
    assessmentPackage: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<RoleplayXResponse>;
  validatePackage(
    assessmentPackage: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<RoleplayXResponse>;
  importPackage(
    assessmentPackage: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<RoleplayXResponse>;
}

export interface RoleplayXClientOptions {
  /** Defaults to ROLEPLAYX_URL, then ROLEPLAYX_BASE_URL. */
  baseUrl?: string;
  /** Defaults to ROLEPLAYX_API_KEY. This value is never logged or returned. */
  apiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

function readConfiguration(options: RoleplayXClientOptions) {
  const baseUrl =
    options.baseUrl ?? process.env.ROLEPLAYX_URL ?? process.env.ROLEPLAYX_BASE_URL;
  const apiKey = options.apiKey ?? process.env.ROLEPLAYX_API_KEY;
  if (!baseUrl) throw new RoleplayXClientConfigurationError("ROLEPLAYX_URL is required");
  if (!apiKey) throw new RoleplayXClientConfigurationError("ROLEPLAYX_API_KEY is required");
  try {
    return { baseUrl: new URL(baseUrl).toString().replace(/\/$/, ""), apiKey };
  } catch {
    throw new RoleplayXClientConfigurationError("ROLEPLAYX_URL must be an absolute URL");
  }
}

function categoryForStatus(status: number): RoleplayXErrorCategory {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  return "server";
}

function safeBody(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Stable key required by RoleplayX for one immutable publication target. */
export function roleplayXIdempotencyKey(input: {
  packageId: string;
  version: number;
  organizationId: string;
  category: string;
}): string {
  return `contentx:${input.packageId}:${input.version}:roleplayx:${input.organizationId}:${input.category}`;
}

export function createRoleplayXClient(options: RoleplayXClientOptions = {}): RoleplayXClient {
  const { baseUrl, apiKey } = readConfiguration(options);
  const request = options.fetch ?? globalThis.fetch;
  if (!request) throw new RoleplayXClientConfigurationError("A fetch implementation is required");
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 5));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function call(
    endpoint: "validate" | "import",
    assessmentPackage: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<RoleplayXResponse> {
    let lastError: RoleplayXClientError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const path = endpoint === "validate"
          ? "/api/content/import/validate"
          : "/api/content/import";
        const response = await request(`${baseUrl}${path}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(assessmentPackage),
          signal: controller.signal,
        });
        const raw: unknown = await response.json().catch(() => undefined);
        if (!response.ok) {
          const category = categoryForStatus(response.status);
          lastError = new RoleplayXClientError(
            category,
            `RoleplayX ${endpoint} failed with HTTP ${response.status}`,
            response.status,
            safeBody(raw),
          );
          if (category !== "server") throw lastError;
        } else {
          const parsed = roleplayXResponseSchema.safeParse(raw);
          if (!parsed.success) {
            throw new RoleplayXClientError(
              "server",
              `RoleplayX ${endpoint} returned an invalid response`,
              response.status,
            );
          }
          return parsed.data;
        }
      } catch (error) {
        if (error instanceof RoleplayXClientError) {
          lastError = error;
          // A malformed successful response is a server-category error, but
          // is not a transient 5xx and must not be retried.
          if (error.category !== "server" || !error.status || error.status < 500) {
            throw error;
          }
        } else {
          const timeout = controller.signal.aborted || (error as Error)?.name === "AbortError";
          lastError = new RoleplayXClientError(
            timeout ? "timeout" : "network",
            timeout ? `RoleplayX ${endpoint} timed out` : `RoleplayX ${endpoint} network failure`,
          );
        }
      } finally {
        clearTimeout(timer);
      }
      if (attempt < maxAttempts) await sleep(25 * attempt);
    }
    throw lastError!;
  }

  const validate = (assessmentPackage: Record<string, unknown>, idempotencyKey: string) =>
    call("validate", assessmentPackage, idempotencyKey);
  const importPackage = (assessmentPackage: Record<string, unknown>, idempotencyKey: string) =>
    call("import", assessmentPackage, idempotencyKey);
  return { validate, import: importPackage, validatePackage: validate, importPackage };
}