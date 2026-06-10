import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, staffQuery, adminOrCommandantQuery, superAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { staffUsers } from "@db/schema";
import { eq, like, and, or, inArray } from "drizzle-orm";
import { hashPassword } from "./lib/custom-auth";

export const usersRouter = createRouter({
  // List all staff users (admin/commandant only)
  list: adminOrCommandantQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          role: z.string().optional(),
          platoon: z.number().optional(),
          isActive: z.number().optional(),
          batchId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [];

      if (input?.search) {
        conditions.push(
          or(
            like(staffUsers.fullName, `%${input.search}%`),
            like(staffUsers.username, `%${input.search}%`)
          )
        );
      }
      if (input?.role) {
        conditions.push(eq(staffUsers.role, input.role as any));
      }
      if (input?.platoon) {
        conditions.push(eq(staffUsers.assignedPlatoon, input.platoon));
      }
      if (input?.isActive !== undefined) {
        conditions.push(eq(staffUsers.isActive, input.isActive as 0 | 1));
      }
      if (input?.batchId) {
        conditions.push(eq(staffUsers.assignedBatchId, input.batchId));
      }

      // Camp commandants can only manage camp-level staff.
      if (ctx.staffUser!.role === "camp_commandant") {
        conditions.push(
          inArray(staffUsers.role, [
            "platoon_instructor",
            "man_o_war_instructor",
            "soldier",
          ])
        );
      }

      const query = conditions.length > 0
        ? db.select().from(staffUsers).where(and(...conditions))
        : db.select().from(staffUsers);

      return query;
    }),

  // Get single user
  get: staffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(staffUsers)
        .where(eq(staffUsers.id, input.id))
        .then((rows) => rows[0] || null);
    }),

  // Create staff user (admin/commandant only)
  create: adminOrCommandantQuery
    .input(
      z.object({
        fullName: z.string().min(1),
        username: z.string().min(3),
        password: z.string().min(6),
        role: z.enum([
          "camp_commandant",
          "state_commandant",
          "platoon_instructor",
          "man_o_war_instructor",
          "soldier",
        ]),
        assignedPlatoon: z.number().min(1).max(10).optional(),
        assignedBatchId: z.number().optional(),
        state: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const passwordHash = await hashPassword(input.password);

      // Check username uniqueness
      const existing = await db
        .select()
        .from(staffUsers)
        .where(eq(staffUsers.username, input.username))
        .then((rows) => rows[0]);

      if (existing) {
        throw new Error("Username already exists");
      }

      const result = await db.insert(staffUsers).values({
        fullName: input.fullName,
        username: input.username,
        passwordHash,
        role: input.role,
        assignedPlatoon: input.assignedPlatoon,
        assignedBatchId: input.assignedBatchId,
        state: input.state,
        isActive: 1,
      });

      return { success: true, id: Number(result[0].insertId) };
    }),

  // Update staff user
  update: adminOrCommandantQuery
    .input(
      z.object({
        id: z.number(),
        fullName: z.string().min(1).optional(),
        username: z.string().min(3).optional(),
        role: z
          .enum([
            "super_admin",
            "camp_commandant",
            "state_commandant",
            "platoon_instructor",
            "man_o_war_instructor",
            "soldier",
          ])
          .optional(),
        assignedPlatoon: z.number().min(1).max(10).optional(),
        assignedBatchId: z.number().optional(),
        state: z.string().optional(),
        isActive: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = getDb();
      await db.update(staffUsers).set(data).where(eq(staffUsers.id, id));
      return { success: true };
    }),

  // Deactivate/Delete (soft delete)
  delete: adminOrCommandantQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(staffUsers)
        .set({ isActive: 0 })
        .where(eq(staffUsers.id, input.id));
      return { success: true };
    }),

  // Permanently remove a staff user from the database.
  hardDelete: superAdminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const user = await db
        .select()
        .from(staffUsers)
        .where(eq(staffUsers.id, input.id))
        .then((rows) => rows[0]);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (user.role === "super_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Super admin accounts cannot be deleted",
        });
      }

      await db.delete(staffUsers).where(eq(staffUsers.id, input.id));
      return { success: true };
    }),

  // Reactivate user
  reactivate: adminOrCommandantQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(staffUsers)
        .set({ isActive: 1 })
        .where(eq(staffUsers.id, input.id));
      return { success: true };
    }),
});
