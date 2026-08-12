import { db, categoriesTable, type CategoryRow } from "@workspace/db";
import { newId } from "../../shared/id";
import {
  CATEGORY_AXES,
  SEED_CATEGORIES,
  type CategoryAxis,
  type Classification,
} from "./taxonomy";

/**
 * Category catalog: fixed seed taxonomy plus auto-extension.
 * Seeds are inserted idempotently; classifier-proposed names not already in
 * the catalog are persisted with origin "auto".
 */

export async function ensureSeedCategories(): Promise<void> {
  const rows = CATEGORY_AXES.flatMap((axis) =>
    SEED_CATEGORIES[axis].map((name) => ({
      id: newId("category"),
      axis,
      name,
      origin: "seed" as const,
    })),
  );
  await db.insert(categoriesTable).values(rows).onConflictDoNothing();
}

export async function listCategories(): Promise<CategoryRow[]> {
  await ensureSeedCategories();
  return db.select().from(categoriesTable);
}

/** Existing category names per axis (for the classifier prompt). */
export async function getCategoryNamesByAxis(): Promise<
  Record<CategoryAxis, string[]>
> {
  const rows = await listCategories();
  const byAxis: Record<CategoryAxis, string[]> = {
    domain: [],
    conflictType: [],
    tone: [],
  };
  for (const row of rows) {
    if (row.axis === "domain" || row.axis === "conflictType" || row.axis === "tone") {
      byAxis[row.axis].push(row.name);
    }
  }
  return byAxis;
}

/** Persist any classifier-proposed category names not yet in the catalog. */
export async function registerAutoCategories(
  classification: Classification,
  existing: Record<CategoryAxis, string[]>,
): Promise<void> {
  const proposals: { axis: CategoryAxis; name: string }[] = [];
  for (const axis of CATEGORY_AXES) {
    const name = classification[axis].trim();
    if (name && !existing[axis].includes(name)) {
      proposals.push({ axis, name });
    }
  }
  if (proposals.length === 0) return;
  await db
    .insert(categoriesTable)
    .values(
      proposals.map((p) => ({
        id: newId("category"),
        axis: p.axis,
        name: p.name,
        origin: "auto" as const,
      })),
    )
    .onConflictDoNothing();
}
