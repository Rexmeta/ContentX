import { db, workflowsTable, type WorkflowRow } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
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
    .where(eq(workflowsTable.id, id))
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
  patch: Partial<{ steps: WorkflowStep[]; status: WorkflowStatus }>,
): Promise<WorkflowRow | null> {
  const [row] = await db
    .update(workflowsTable)
    .set(patch)
    .where(
      and(
        eq(workflowsTable.id, id),
        eq(workflowsTable.updatedAt, observedUpdatedAt),
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const rows = await db
    .delete(workflowsTable)
    .where(eq(workflowsTable.id, id))
    .returning({ id: workflowsTable.id });
  return rows.length > 0;
}
