import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import * as repository from "./repository";

export function assessmentActor(req: Request): string | null {
  // Tests may mount routers without Clerk; no headers or client actor IDs are trusted.
  try { return getAuth(req).userId ?? null; } catch { return null; }
}
export function requireAssessmentAuthor(req: Request, res: Response, next: NextFunction): void {
  if (!assessmentActor(req)) { res.status(401).json({ error: "진단 작성은 로그인이 필요합니다." }); return; }
  next();
}
export async function protectDiagnosticPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = String(req.params.id ?? req.params.packageId ?? "");
  if (["templates", "from-template", "diagnostic-sample"].includes(id)) { next(); return; }
  // Public preview and its phase-filtered media are the only anonymous paths.
  if (/\/participant$/.test(req.path) || /\/media\/[a-zA-Z0-9_-]+$/.test(req.path)) { next(); return; }
  const pkg = await repository.getAssessmentPackage(id);
  if (pkg?.diagnosticOwnerId) {
    res.set("Cache-Control", "private, no-store");
    res.vary("Cookie").vary("Authorization");
  }
  if (pkg?.diagnosticOwnerId && pkg.diagnosticOwnerId !== assessmentActor(req)) {
    res.status(assessmentActor(req) ? 403 : 401).json({ error: "작성자 또는 권한 있는 실행 서버만 전체 평가 데이터에 접근할 수 있습니다." });
    return;
  }
  next();
}
