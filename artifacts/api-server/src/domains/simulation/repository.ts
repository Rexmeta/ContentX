import { asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  simulationsTable,
  interactionEventsTable,
  agentStatesTable,
  characterSnapshotsTable,
  type SimulationRow,
  type InteractionEventRow,
  type InsertSimulation,
  type InsertInteractionEvent,
} from "@workspace/db";

export interface StateMerge {
  agentId: string;
  category: string;
  values: Record<string, number>;
  /** Version observed when the simulation captured its inputs. */
  expectedVersion: number;
}

/** A concurrent writer changed agent state after the simulation read it. */
export class StateConflictError extends Error {
  constructor(agentId: string, category: string) {
    super(
      `Agent "${agentId}" state category "${category}" was modified concurrently during the simulation; rerun the simulation.`,
    );
    this.name = "StateConflictError";
  }
}

/**
 * Persist a finished simulation ATOMICALLY: the simulation row, its full
 * immutable trace, the final agent state merges, and the snapshot
 * used-by-simulation marks all commit in one transaction. A simulation
 * without its trace (or vice versa) can never exist.
 */
export async function insertSimulationWithTrace(
  simulation: InsertSimulation,
  events: InsertInteractionEvent[],
  stateMerges: StateMerge[],
  usedSnapshotIds: string[],
): Promise<{ simulation: SimulationRow; events: InteractionEventRow[] }> {
  return db.transaction(async (tx) => {
    const [insertedSim] = await tx
      .insert(simulationsTable)
      .values(simulation)
      .returning();
    if (!insertedSim) throw new Error("Failed to insert simulation");
    let insertedEvents: InteractionEventRow[] = [];
    if (events.length > 0) {
      insertedEvents = await tx
        .insert(interactionEventsTable)
        .values(events)
        .returning();
      if (insertedEvents.length !== events.length) {
        throw new Error("Failed to persist the full interaction trace");
      }
    }
    // Canonical lock order: sort merges by (agentId, category) regardless
    // of participant/input order so overlapping simulations can never
    // acquire agent_states row locks in opposite orders (deadlock).
    const orderedMerges = [...stateMerges].sort((a, b) =>
      a.agentId === b.agentId
        ? a.category.localeCompare(b.category)
        : a.agentId.localeCompare(b.agentId),
    );
    for (const merge of orderedMerges) {
      // Optimistic concurrency: the update only applies if nobody else
      // touched the row since the simulation captured its inputs —
      // otherwise the whole transaction (simulation + trace) rolls back.
      const updated = await tx
        .update(agentStatesTable)
        .set({
          values: sql`${agentStatesTable.values} || ${JSON.stringify(merge.values)}::jsonb`,
          version: sql`${agentStatesTable.version} + 1`,
        })
        .where(
          sql`${agentStatesTable.agentId} = ${merge.agentId} and ${agentStatesTable.category} = ${merge.category} and ${agentStatesTable.version} = ${merge.expectedVersion}`,
        )
        .returning({ id: agentStatesTable.id });
      if (updated.length !== 1) {
        throw new StateConflictError(merge.agentId, merge.category);
      }
    }
    for (const snapshotId of usedSnapshotIds) {
      const marked = await tx
        .update(characterSnapshotsTable)
        .set({ usedBySimulation: true })
        .where(eq(characterSnapshotsTable.id, snapshotId))
        .returning({ id: characterSnapshotsTable.id });
      if (marked.length !== 1) {
        throw new Error(`Failed to mark snapshot "${snapshotId}" as used`);
      }
    }
    return { simulation: insertedSim, events: insertedEvents };
  });
}

export async function getSimulation(
  id: string,
): Promise<SimulationRow | undefined> {
  const [row] = await db
    .select()
    .from(simulationsTable)
    .where(eq(simulationsTable.id, id));
  return row;
}

export async function listSimulations(): Promise<SimulationRow[]> {
  return db
    .select()
    .from(simulationsTable)
    .orderBy(desc(simulationsTable.createdAt));
}

/** Trace is append-only and read in total (sequence) order. No update path. */
export async function listEventsForSimulation(
  simulationId: string,
): Promise<InteractionEventRow[]> {
  return db
    .select()
    .from(interactionEventsTable)
    .where(eq(interactionEventsTable.simulationId, simulationId))
    .orderBy(asc(interactionEventsTable.sequence));
}
