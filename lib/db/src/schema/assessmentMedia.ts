import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Private upload references; bytes live only in App Storage. */
export const assessmentMediaTable = pgTable("assessment_media", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertAssessmentMediaSchema = createInsertSchema(assessmentMediaTable).omit({ createdAt: true });
export type InsertAssessmentMedia = z.infer<typeof insertAssessmentMediaSchema>;
