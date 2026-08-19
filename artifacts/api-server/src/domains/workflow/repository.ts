import { db, workflowsTable, type WorkflowRow } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  OutputIntent,
  Workflow,
  WorkflowStatus,
  WorkflowStep,
} from "./model";

export function toWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    title: row.title,
    intent: row.intent as OutputIntent,
    steps: row.steps as WorkflowStep[],
    artifacts: (row.artifacts as Record<string, string>) ?? {},
    status: row.status as WorkflowStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listWorkflows(): Promise<WorkflowRow[]> {
  return db
    .select()
    .from(workflowsTable)
    .orderBy(desc(workflowsTable.createdAt));
}

export async function getWorkflow(id: string): Promise<WorkflowRow | null> {
  const [row] = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, id));
  return row ?? null;
}

export async function insertWorkflow(input: {
  id: string;
  title: string;
  intent: OutputIntent;
  steps: WorkflowStep[];
  artifacts?: Record<string, string>;
  status?: WorkflowStatus;
}): Promise<WorkflowRow> {
  const [row] = await db
    .insert(workflowsTable)
    .values({
      id: input.id,
      title: input.title,
      intent: input.intent,
      steps: input.steps,
      artifacts: input.artifacts ?? {},
      status: input.status ?? "draft",
    })
    .returning();
  return row!;
}

export async function updateWorkflow(
  id: string,
  patch: Partial<{
    title: string;
    steps: WorkflowStep[];
    artifacts: Record<string, string>;
    status: WorkflowStatus;
  }>,
): Promise<WorkflowRow | null> {
  const [row] = await db
    .update(workflowsTable)
    .set(patch)
    .where(
      and(
        eq(workflowsTable.id, id),
        sql`NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${workflowsTable.steps}) AS candidate
          WHERE candidate->>'status' = 'running'
        )`,
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Conditional update used by stale-run recovery: only applies the patch when
 * the row's updatedAt still equals the value the caller observed. If a
 * concurrently completing action (or another reader's recovery) has touched
 * the row in the meantime, no write happens and null is returned.
 */
export async function updateWorkflowIfUntouched(
  id: string,
  observedUpdatedAt: Date,
  patch: Partial<{
    title: string;
    steps: WorkflowStep[];
    artifacts: Record<string, string>;
    status: WorkflowStatus;
  }>,
): Promise<WorkflowRow | null> {
  const observedMillisecondEnd = new Date(observedUpdatedAt.getTime() + 1);
  const [row] = await db
    .update(workflowsTable)
    .set(patch)
    .where(
      and(
        eq(workflowsTable.id, id),
        // PostgreSQL stores microseconds while JavaScript Date preserves only
        // milliseconds. Match the exact millisecond observed by the caller.
        sql`${workflowsTable.updatedAt} >= ${observedUpdatedAt}`,
        sql`${workflowsTable.updatedAt} < ${observedMillisecondEnd}`,
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Applies a user review decision only when the complete workflow snapshot the
 * reviewer saw is still current. Exact JSONB predicates prevent an older tab
 * from approving over newer step output, even within one timestamp millisecond.
 */
export async function updateWorkflowIfSnapshotMatches(
  id: string,
  observed: {
    steps: WorkflowStep[];
    artifacts: Record<string, string>;
    status: WorkflowStatus;
  },
  patch: Partial<{
    steps: WorkflowStep[];
    artifacts: Record<string, string>;
    status: WorkflowStatus;
  }>,
): Promise<WorkflowRow | null> {
  const [row] = await db
    .update(workflowsTable)
    .set(patch)
    .where(
      and(
        eq(workflowsTable.id, id),
        sql`${workflowsTable.steps} = ${JSON.stringify(observed.steps)}::jsonb`,
        sql`${workflowsTable.artifacts} = ${JSON.stringify(observed.artifacts)}::jsonb`,
        eq(workflowsTable.status, observed.status),
        sql`NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${workflowsTable.steps}) AS candidate
          WHERE candidate->>'status' = 'running'
        )`,
      ),
    )
    .returning();
  return row ?? null;
}

/** Atomically transitions one ready/failed step into a run owned by runId. */
export async function claimWorkflowStep(
  id: string,
  stepId: string,
  expectedStatus: "ready" | "failed" | "complete",
  observed: {
    updatedAt: Date;
    steps: WorkflowStep[];
    artifacts: Record<string, string>;
    status: WorkflowStatus;
  },
  patch: Partial<{
    steps: WorkflowStep[];
    artifacts: Record<string, string>;
    status: WorkflowStatus;
  }>,
): Promise<WorkflowRow | null> {
  const observedMillisecondEnd = new Date(observed.updatedAt.getTime() + 1);
  const [row] = await db
    .update(workflowsTable)
    .set(patch)
    .where(
      and(
        eq(workflowsTable.id, id),
        sql`${workflowsTable.updatedAt} >= ${observed.updatedAt}`,
        sql`${workflowsTable.updatedAt} < ${observedMillisecondEnd}`,
        sql`${workflowsTable.steps} = ${JSON.stringify(observed.steps)}::jsonb`,
        sql`${workflowsTable.artifacts} = ${JSON.stringify(observed.artifacts)}::jsonb`,
        eq(workflowsTable.status, observed.status),
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${workflowsTable.steps}) AS candidate
          WHERE candidate->>'id' = ${stepId}
            AND candidate->>'status' = ${expectedStatus}
        )`,
        sql`NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${workflowsTable.steps}) AS candidate
          WHERE candidate->>'status' = 'running'
        )`,
      ),
    )
    .returning();
  return row ?? null;
}

/** Refreshes the durable liveness lease without replacing workflow JSON. */
export async function touchWorkflowRun(
  id: string,
  stepId: string,
  runId: string,
): Promise<boolean> {
  const rows = await db
    .update(workflowsTable)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(workflowsTable.id, id),
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${workflowsTable.steps}) AS candidate
          WHERE candidate->>'id' = ${stepId}
            AND candidate->>'status' = 'running'
            AND candidate->'progress'->>'runId' = ${runId}
        )`,
      ),
    )
    .returning({ id: workflowsTable.id });
  return rows.length > 0;
}

/** Writes progress/outcome only while the same execution still owns the step. */
export async function updateWorkflowIfRunOwned(
  id: string,
  stepId: string,
  runId: string,
  patch: Partial<{
    steps: WorkflowStep[];
    artifacts: Record<string, string>;
    status: WorkflowStatus;
  }>,
): Promise<WorkflowRow | null> {
  const [row] = await db
    .update(workflowsTable)
    .set(patch)
    .where(
      and(
        eq(workflowsTable.id, id),
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${workflowsTable.steps}) AS candidate
          WHERE candidate->>'id' = ${stepId}
            AND candidate->>'status' = 'running'
            AND candidate->'progress'->>'runId' = ${runId}
        )`,
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const rows = await db
    .delete(workflowsTable)
    .where(
      and(
        eq(workflowsTable.id, id),
        sql`NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${workflowsTable.steps}) AS candidate
          WHERE candidate->>'status' = 'running'
        )`,
      ),
    )
    .returning({ id: workflowsTable.id });
  return rows.length > 0;
}
