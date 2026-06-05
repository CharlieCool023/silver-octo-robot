import { z } from "zod";
import { createRouter, publicQuery, staffQuery, adminOrCommandantQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { batches, corpsMembers, evaluations, comments, commandantComments, higherInstitutions } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const batchesRouter = createRouter({
  // List all batches (public so registration page can check for active batch)
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(batches).orderBy(desc(batches.createdAt));
  }),

  // Get active batch
  getActive: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(batches)
      .where(eq(batches.isActive, 1))
      .then((rows) => rows[0] || null);
  }),

  // Get single batch
  get: staffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(batches)
        .where(eq(batches.id, input.id))
        .then((rows) => rows[0] || null);
    }),

  // Create batch
  create: adminOrCommandantQuery
    .input(
      z.object({
        name: z.string().min(1),
        year: z.number().min(2000).max(2100),
        state: z.enum(["ondo", "lagos"]),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(batches).values(input);
      return { success: true, id: Number(result[0].insertId) };
    }),

  // Update batch
  update: adminOrCommandantQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        year: z.number().optional(),
        state: z.enum(["ondo", "lagos"]).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = getDb();
      await db.update(batches).set(data).where(eq(batches.id, id));
      return { success: true };
    }),

  // Activate a batch (deactivates all others)
  activate: adminOrCommandantQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Deactivate all batches
      await db.update(batches).set({ isActive: 0 });
      // Activate selected batch
      await db
        .update(batches)
        .set({ isActive: 1 })
        .where(eq(batches.id, input.id));
      return { success: true };
    }),

  // Deactivate a batch
  deactivate: adminOrCommandantQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(batches)
        .set({ isActive: 0 })
        .where(eq(batches.id, input.id));
      return { success: true };
    }),

  // Delete batch — permanently removes batch AND all associated data
  delete: adminOrCommandantQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get all corps members in this batch
      const members = await db
        .select({ id: corpsMembers.id })
        .from(corpsMembers)
        .where(eq(corpsMembers.batchId, input.id));

      // For each member, delete all related child rows first
      for (const member of members) {
        await db.delete(evaluations).where(eq(evaluations.corpsMemberId, member.id));
        await db.delete(comments).where(eq(comments.corpsMemberId, member.id));
        await db.delete(commandantComments).where(eq(commandantComments.corpsMemberId, member.id));
        await db.delete(higherInstitutions).where(eq(higherInstitutions.corpsMemberId, member.id));
      }

      // Delete all corps members in the batch
      await db.delete(corpsMembers).where(eq(corpsMembers.batchId, input.id));

      // Finally delete the batch itself
      await db.delete(batches).where(eq(batches.id, input.id));

      return { success: true };
    }),
});
