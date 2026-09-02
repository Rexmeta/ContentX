import { Router } from "express";
import {
  OrganizationSchema,
  ProjectSchema,
  MemberSchema,
  ApiKeySchema,
} from "@workspace/simulation-contract";
import { organizationService } from "../domains/saas/organizationService";
import { apiKeyService } from "../domains/saas/apiKeyService";
import { auditLogService } from "../domains/saas/auditLogService";
import { usageMeteringService } from "../domains/saas/usageMeteringService";
import { dashboardService } from "../domains/saas/dashboardService";
import { failureExplorerService } from "../domains/saas/failureExplorerService";
import { correlationLineageManager } from "../domains/saas/observability";
import { requireTenantIsolation, requireScope, extractPrincipal } from "../domains/saas/authMiddleware";

const router = Router();

// POST /v1/organizations — Create an Organization
router.post("/v1/organizations", (req, res) => {
  try {
    const { name, slug, plan } = req.body || {};
    if (!name || !slug) {
      res.status(400).json({ error: "name and slug are required" });
      return;
    }
    const org = organizationService.createOrganization({ name, slug, plan });
    auditLogService.log({
      organizationId: org.id,
      actorId: "system",
      actorType: "user",
      action: "organization_created",
      targetResourceId: org.id,
      targetResourceType: "organization",
      metadata: { name, slug, plan: org.plan },
    });
    res.status(201).json(org);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create organization";
    res.status(500).json({ error: message });
  }
});

// GET /v1/organizations — List Organizations
router.get("/v1/organizations", (_req, res) => {
  res.json(organizationService.listOrganizations());
});

// GET /v1/organizations/:orgId — Get Organization Details
router.get("/v1/organizations/:orgId", requireTenantIsolation, (req, res) => {
  const org = organizationService.getOrganization(req.params.orgId);
  if (!org) {
    res.status(404).json({ error: `Organization "${req.params.orgId}" not found` });
    return;
  }
  res.json(org);
});

// POST /v1/organizations/:orgId/projects — Create Project under Organization
router.post("/v1/organizations/:orgId/projects", requireTenantIsolation, (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }
    const project = organizationService.createProject({
      organizationId: req.params.orgId,
      name,
      description,
    });
    auditLogService.log({
      organizationId: req.params.orgId,
      projectId: project.id,
      actorId: "system",
      actorType: "user",
      action: "project_created",
      targetResourceId: project.id,
      targetResourceType: "project",
      metadata: { name },
    });
    res.status(201).json(project);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create project";
    res.status(500).json({ error: message });
  }
});

// GET /v1/organizations/:orgId/projects — List Projects
router.get("/v1/organizations/:orgId/projects", requireTenantIsolation, (req, res) => {
  res.json(organizationService.listProjects(req.params.orgId));
});

// POST /v1/organizations/:orgId/members — Add Member
router.post("/v1/organizations/:orgId/members", requireTenantIsolation, (req, res) => {
  try {
    const { email, name, role } = req.body || {};
    if (!email || !name) {
      res.status(400).json({ error: "email and name are required" });
      return;
    }
    const member = organizationService.addMember({
      organizationId: req.params.orgId,
      email,
      name,
      role,
    });
    res.status(201).json(member);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add member";
    res.status(500).json({ error: message });
  }
});

// GET /v1/organizations/:orgId/members — List Members
router.get("/v1/organizations/:orgId/members", requireTenantIsolation, (req, res) => {
  res.json(organizationService.listMembers(req.params.orgId));
});

// POST /v1/organizations/:orgId/api-keys — Generate API Key / Service Account
router.post("/v1/organizations/:orgId/api-keys", requireTenantIsolation, (req, res) => {
  try {
    const { name, projectId, scopes } = req.body || {};
    if (!name || !Array.isArray(scopes)) {
      res.status(400).json({ error: "name and scopes array are required" });
      return;
    }
    const result = apiKeyService.generateApiKey({
      organizationId: req.params.orgId,
      projectId,
      name,
      scopes,
    });
    auditLogService.log({
      organizationId: req.params.orgId,
      projectId,
      actorId: "system",
      actorType: "user",
      action: "api_key_generated",
      targetResourceId: result.apiKey.id,
      targetResourceType: "api_key",
      metadata: { name, scopes },
    });
    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate API key";
    res.status(500).json({ error: message });
  }
});

// GET /v1/organizations/:orgId/api-keys — List API Keys
router.get("/v1/organizations/:orgId/api-keys", requireTenantIsolation, (req, res) => {
  res.json(apiKeyService.listApiKeys(req.params.orgId));
});

// GET /v1/organizations/:orgId/dashboard — Get Unified Dashboard Summary
router.get("/v1/organizations/:orgId/dashboard", requireTenantIsolation, (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const summary = dashboardService.getSummary({
    organizationId: req.params.orgId,
    projectId,
  });
  res.json(summary);
});

// GET /v1/organizations/:orgId/audit-logs — Get Audit Logs
router.get("/v1/organizations/:orgId/audit-logs", requireTenantIsolation, (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  res.json(auditLogService.listLogs(req.params.orgId, projectId));
});

// GET /v1/organizations/:orgId/usage — Get Usage Metering & Quotas
router.get("/v1/organizations/:orgId/usage", requireTenantIsolation, (req, res) => {
  const period = req.query.period as string | undefined;
  res.json(usageMeteringService.getUsage(req.params.orgId, period));
});

// GET /v1/projects/:projectId/failure-explorer — Interactive Failure Explorer
router.get("/v1/projects/:projectId/failure-explorer", requireTenantIsolation, (_req, res) => {
  const mockBenchmark: any = { agents: [] };
  const nodes = failureExplorerService.buildFailureNodes(mockBenchmark);
  res.json(nodes);
});

export default router;
