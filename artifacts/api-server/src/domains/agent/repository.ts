import { asc, desc, eq, and, sql } from "drizzle-orm";
import {
  db,
  agentsTable,
  agentStatesTable,
  type AgentRow,
  type AgentStateRow,
  type InsertAgent,
  type InsertAgentState,
} from "@workspace/db";

/**
 * Agent + AgentState persistence. Agent creation and its initial state
 * rows commit in ONE transaction — an agent without initialized state is
 * not a valid record.
 */
export async function insertAgentWithStates(
  agent: InsertAgent,
  states: InsertAgentState[],
): Promise<{ agent: AgentRow; states: AgentStateRow[] }> {
  return db.transaction(async (tx) => {
    const [insertedAgent] = await tx
      .insert(agentsTable)
      .values(agent)
      .returning();
    if (!insertedAgent) throw new Error("Failed to insert agent");
    const insertedStates = await tx
      .insert(agentStatesTable)
      .values(states)
      .returning();
    if (insertedStates.length !== states.length) {
      throw new Error("Failed to initialize agent states");
    }
    return { agent: insertedAgent, states: insertedStates };
  });
}

export async function getAgent(id: string): Promise<AgentRow | undefined> {
  const [row] = await db.select().from(agentsTable).where(eq(agentsTable.id, id));
  return row;
}

export async function listAgents(): Promise<AgentRow[]> {
  return db.select().from(agentsTable).orderBy(desc(agentsTable.createdAt));
}

export async function deleteAgent(id: string): Promise<boolean> {
  const deleted = await db
    .delete(agentsTable)
    .where(eq(agentsTable.id, id))
    .returning({ id: agentsTable.id });
  return deleted.length > 0;
}

export async function listStatesForAgent(
  agentId: string,
): Promise<AgentStateRow[]> {
  return db
    .select()
    .from(agentStatesTable)
    .where(eq(agentStatesTable.agentId, agentId))
    .orderBy(asc(agentStatesTable.category));
}

/**
 * Merge-update one state category atomically: values are merged over the
 * existing map and `version` is incremented in the same UPDATE (no
 * read-modify-write race). Returns undefined when the row is missing.
 */
export async function mergeStateValues(
  agentId: string,
  category: string,
  values: Record<string, number>,
): Promise<AgentStateRow | undefined> {
  const [updated] = await db
    .update(agentStatesTable)
    .set({
      values: sql`${agentStatesTable.values} || ${JSON.stringify(values)}::jsonb`,
      version: sql`${agentStatesTable.version} + 1`,
    })
    .where(
      and(
        eq(agentStatesTable.agentId, agentId),
        eq(agentStatesTable.category, category),
      ),
    )
    .returning();
  return updated;
}
