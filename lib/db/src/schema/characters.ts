import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Canonical Character — a first-class domain record on top of the Entity
 * concept (kind "person"/"character"). Attribute groups are stored as JSONB
 * because they are dimension-keyed and extensible; identity columns stay
 * normalized. Runtime state (Agent/AgentState) NEVER lives here.
 */
export const charactersTable = pgTable("characters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  canonicalName: text("canonical_name"),
  aliases: jsonb("aliases"),
  // Structured attribute groups: identity / professional / psychological /
  // behavioral / capabilities / preferences / goals / constraints.
  attributes: jsonb("attributes").notNull(),
  // Derived classifications only (e.g. MBTI); never part of the core model.
  derivedClassifications: jsonb("derived_classifications"),
  provenance: jsonb("provenance").notNull(),
  schemaVersion: text("schema_version").notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type CharacterRow = typeof charactersTable.$inferSelect;
