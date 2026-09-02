import type {
  SourceProvenance,
  ProvenanceLineage,
  CanonicalLineageRecord,
  SourceType,
} from "@workspace/simulation-contract";
import { computeCanonicalLineageHash } from "@workspace/simulation-contract";

export interface RegisterLineageInput {
  organizationId: string;
  projectId?: string;
  sourceType: SourceType;
  sourceId: string;
  sourceVersion?: string;
  sourceDataset?: string;
  sourceDatasetVersion?: string;
  samplingRunId?: string;
  populationVersion?: string;
  characterId?: string;
  snapshotId?: string;
  trajectoryId?: string;
  evaluationId?: string;
  evidenceTraceId?: string;
  canonicalPayload: Record<string, unknown>;
  dimensions?: Record<string, number>;
  traits?: Record<string, unknown>;
}

export class ProvenanceLineageResolver {
  private records: Map<string, CanonicalLineageRecord> = new Map(); // recordId -> CanonicalLineageRecord
  private evidenceIndex: Map<string, string> = new Map(); // evidenceTraceId -> recordId
  private evaluationIndex: Map<string, string> = new Map(); // evaluationId -> recordId
  private characterIndex: Map<string, string> = new Map(); // characterId -> recordId

  /**
   * Registers a canonical lineage record with deterministic SHA-256 hash
   */
  registerLineage(input: RegisterLineageInput): CanonicalLineageRecord {
    const sourceVersion = input.sourceVersion ?? "1.0.0";
    const entityLineageHash = computeCanonicalLineageHash({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceVersion,
      sourceDataset: input.sourceDataset,
      sourceDatasetVersion: input.sourceDatasetVersion,
      canonicalPayload: input.canonicalPayload,
      dimensions: input.dimensions,
      traits: input.traits,
    });

    const recordId = `lin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const source: SourceProvenance = {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceVersion,
      sourceDataset: input.sourceDataset,
      sourceDatasetVersion: input.sourceDatasetVersion,
      metadata: input.traits ?? {},
    };

    const lineage: ProvenanceLineage = {
      samplingRunId: input.samplingRunId,
      populationVersion: input.populationVersion,
      characterId: input.characterId,
      snapshotId: input.snapshotId,
      trajectoryId: input.trajectoryId,
      evaluationId: input.evaluationId,
      evidenceTraceId: input.evidenceTraceId,
    };

    const record: CanonicalLineageRecord = {
      id: recordId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      source,
      lineage,
      entityLineageHash,
      createdAt: new Date().toISOString(),
    };

    this.records.set(recordId, record);

    if (input.evidenceTraceId) this.evidenceIndex.set(input.evidenceTraceId, recordId);
    if (input.evaluationId) this.evaluationIndex.set(input.evaluationId, recordId);
    if (input.characterId) this.characterIndex.set(input.characterId, recordId);

    return record;
  }

  /**
   * Reverse Traceability: Resolves source dataset and version from evidence, evaluation, or character ID
   */
  resolveSourceByEvidence(evidenceTraceId: string, callerOrgId?: string): CanonicalLineageRecord | null {
    const recordId = this.evidenceIndex.get(evidenceTraceId);
    if (!recordId) return null;
    const record = this.records.get(recordId);
    if (!record) return null;

    if (callerOrgId && record.organizationId !== callerOrgId) {
      throw new Error(`Forbidden: Cross-tenant access to lineage record "${recordId}" is prohibited.`);
    }
    return record;
  }

  resolveSourceByEvaluation(evaluationId: string, callerOrgId?: string): CanonicalLineageRecord | null {
    const recordId = this.evaluationIndex.get(evaluationId);
    if (!recordId) return null;
    const record = this.records.get(recordId);
    if (!record) return null;

    if (callerOrgId && record.organizationId !== callerOrgId) {
      throw new Error(`Forbidden: Cross-tenant access to lineage record "${recordId}" is prohibited.`);
    }
    return record;
  }

  resolveSourceByCharacter(characterId: string, callerOrgId?: string): CanonicalLineageRecord | null {
    const recordId = this.characterIndex.get(characterId);
    if (!recordId) return null;
    const record = this.records.get(recordId);
    if (!record) return null;

    if (callerOrgId && record.organizationId !== callerOrgId) {
      throw new Error(`Forbidden: Cross-tenant access to lineage record "${recordId}" is prohibited.`);
    }
    return record;
  }

  /**
   * Graceful fallback for legacy entities without lineage records
   */
  getLineageSafe(recordId: string): CanonicalLineageRecord | null {
    return this.records.get(recordId) ?? null;
  }
}

export const provenanceLineageResolver = new ProvenanceLineageResolver();
