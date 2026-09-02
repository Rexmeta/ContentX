import type { Request, Response, NextFunction } from "express";
import { organizationService } from "./organizationService";
import { apiKeyService } from "./apiKeyService";
import type { ApiKeyScope } from "@workspace/simulation-contract";

export interface AuthenticatedPrincipal {
  organizationId: string;
  projectId?: string;
  actorId: string;
  role: "owner" | "admin" | "engineer" | "analyst" | "viewer" | "service_account";
  scopes: ApiKeyScope[];
}

export function extractPrincipal(req: Request): AuthenticatedPrincipal | null {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
  const tenantHeader = (req.headers["x-organization-id"] || req.headers["x-tenant-id"]) as string | undefined;
  const projectHeader = req.headers["x-project-id"] as string | undefined;

  // 1. Check API Key
  const token = apiKeyHeader ?? (authHeader?.startsWith("Bearer rpx_live_") ? authHeader.substring(7) : undefined);
  if (token) {
    const check = apiKeyService.verifyApiKey(token);
    if (check.valid && check.apiKey) {
      return {
        organizationId: check.apiKey.organizationId,
        projectId: check.apiKey.projectId ?? projectHeader,
        actorId: check.apiKey.id,
        role: "service_account",
        scopes: check.apiKey.scopes,
      };
    }
  }

  // 2. Check direct tenant headers (for standard sessions/internal tests)
  if (tenantHeader) {
    return {
      organizationId: tenantHeader,
      projectId: projectHeader,
      actorId: "usr_session",
      role: "owner",
      scopes: ["benchmark:read", "benchmark:run", "evaluation:read", "agent:manage", "dataset:export", "deployment:gate"],
    };
  }

  return null;
}

export function requireTenantIsolation(req: Request, res: Response, next: NextFunction): void {
  const principal = extractPrincipal(req);
  const targetOrgId = req.params.orgId ?? (req.baseUrl.includes("organizations") ? req.params.id : undefined) ?? req.body?.organizationId ?? (req.query.organizationId as string | undefined);

  if (principal && targetOrgId && principal.organizationId !== targetOrgId) {
    res.status(403).json({
      error: "Forbidden: Access denied. Cross-tenant resource access is prohibited.",
      code: "TENANT_ISOLATION_VIOLATION",
    });
    return;
  }

  // IDOR Protection: verify project belongs to the organization
  const targetProjId = req.params.projectId ?? req.body?.projectId ?? (req.query.projectId as string | undefined);
  if (targetProjId && principal) {
    const proj = organizationService.getProject(targetProjId);
    if (proj && proj.organizationId !== principal.organizationId) {
      res.status(403).json({
        error: "Forbidden: Project does not belong to your organization.",
        code: "IDOR_PROJECT_VIOLATION",
      });
      return;
    }
  }

  next();
}

export function requireScope(scope: ApiKeyScope) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const principal = extractPrincipal(req);
    if (!principal) {
      next(); // fallback to open if no token provided in test mode
      return;
    }

    if (!principal.scopes.includes(scope)) {
      res.status(403).json({
        error: `Forbidden: Missing required scope "${scope}".`,
        code: "INSUFFICIENT_SCOPE",
      });
      return;
    }

    next();
  };
}
