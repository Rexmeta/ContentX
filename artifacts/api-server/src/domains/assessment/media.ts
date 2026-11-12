import { db, assessmentMediaTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { DiagnosticAuthoring } from "@workspace/api-zod";
import { ObjectStorageService } from "../../lib/objectStorage";
import { randomUUID } from "node:crypto";

export const mediaStorage = new ObjectStorageService();
export async function getAssessmentMedia(id: string) {
  const [row] = await db.select().from(assessmentMediaTable).where(eq(assessmentMediaTable.id, id));
  return row;
}
export async function requestMediaUpload(ownerId: string, contentType: string) {
  const uploadURL = await mediaStorage.getObjectEntityUploadURL();
  const assetId = `assessmentmedia_${randomUUID()}`;
  await db.insert(assessmentMediaTable).values({
    id: assetId, ownerId, contentType, objectPath: mediaStorage.normalizeObjectEntityPath(uploadURL),
  });
  return { assetId, uploadURL };
}
export async function validateDiagnosticMedia(source: DiagnosticAuthoring, ownerId: string) {
  for (const scenario of source.scenarios) for (const material of scenario.materials) {
    if (!material.assetId) continue;
    const row = await getAssessmentMedia(material.assetId);
    if (!row || row.ownerId !== ownerId) throw new Error("Media must belong to the diagnostic author");
    if (!row.contentType.startsWith(`${material.type}/`)) throw new Error("Media type mismatch");
    const file = await mediaStorage.getObjectEntityFile(row.objectPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 50 * 1024 * 1024) throw new Error("Media must not exceed 50 MB");
  }
}
