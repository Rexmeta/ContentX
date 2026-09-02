import type { AuditLogEntry, AuditLogAction } from "@workspace/simulation-contract";

export class AuditLogService {
  private logs: AuditLogEntry[] = [];

  log(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.logs.push(fullEntry);
    return fullEntry;
  }

  listLogs(organizationId: string, projectId?: string): AuditLogEntry[] {
    return this.logs.filter((l) => {
      if (l.organizationId !== organizationId) return false;
      if (projectId && l.projectId !== projectId) return false;
      return true;
    });
  }
}

export const auditLogService = new AuditLogService();
