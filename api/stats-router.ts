import { createRouter, staffQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { corpsMembers, evaluations, comments, staffUsers, batches } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";

export const statsRouter = createRouter({
  // Dashboard stats (role-specific)
  dashboard: staffQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = ctx.staffUser!;

    // Get active batch
    const activeBatch = await db
      .select()
      .from(batches)
      .where(eq(batches.isActive, 1))
      .then((rows) => rows[0] || null);

    const stats: Record<string, any> = {
      activeBatch: activeBatch
        ? { id: activeBatch.id, name: activeBatch.name, state: activeBatch.state }
        : null,
    };

    if (user.role === "super_admin") {
      // Total staff users
      const totalUsers = await db
        .select({ count: sql<number>`count(*)` })
        .from(staffUsers)
        .then((r) => r[0].count);

      const totalCommandants = await db
        .select({ count: sql<number>`count(*)` })
        .from(staffUsers)
        .where(eq(staffUsers.role, "camp_commandant"))
        .then((r) => r[0].count);

      const totalBatches = await db
        .select({ count: sql<number>`count(*)` })
        .from(batches)
        .then((r) => r[0].count);

      const totalCorpsMembers = await db
        .select({ count: sql<number>`count(*)` })
        .from(corpsMembers)
        .then((r) => r[0].count);

      stats.totalUsers = totalUsers;
      stats.totalCommandants = totalCommandants;
      stats.totalBatches = totalBatches;
      stats.totalCorpsMembers = totalCorpsMembers;
    }

    if (
      user.role === "camp_commandant" ||
      user.role === "state_commandant"
    ) {
      const totalMembers = activeBatch
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(corpsMembers)
            .where(eq(corpsMembers.batchId, activeBatch.id))
            .then((r) => r[0].count)
        : 0;

      const totalBatches = await db
        .select({ count: sql<number>`count(*)` })
        .from(batches)
        .then((r) => r[0].count);

      stats.totalCorpsMembers = totalMembers;
      stats.totalBatches = totalBatches;

      // Evaluated count
      if (activeBatch) {
        const batchMembers = await db
          .select({ id: corpsMembers.id })
          .from(corpsMembers)
          .where(eq(corpsMembers.batchId, activeBatch.id));

        const memberIds = batchMembers.map((m) => m.id);

        let evaluatedCount = 0;
        let commentedCount = 0;

        for (const memberId of memberIds) {
          const piEval = await db
            .select()
            .from(evaluations)
            .where(
              and(
                eq(evaluations.corpsMemberId, memberId),
                eq(evaluations.evaluatorRole, "platoon_instructor")
              )
            )
            .then((rows) => rows[0]);

          const mowEval = await db
            .select()
            .from(evaluations)
            .where(
              and(
                eq(evaluations.corpsMemberId, memberId),
                eq(evaluations.evaluatorRole, "man_o_war_instructor")
              )
            )
            .then((rows) => rows[0]);

          if (piEval && mowEval) evaluatedCount++;

          const memberComments = await db
            .select()
            .from(comments)
            .where(eq(comments.corpsMemberId, memberId));

          if (memberComments.length > 0) commentedCount++;
        }

        stats.evaluatedCount = evaluatedCount;
        stats.commentedCount = commentedCount;
      }
    }

    if (
      user.role === "platoon_instructor" ||
      user.role === "man_o_war_instructor" ||
      user.role === "soldier"
    ) {
      const platoon = user.assignedPlatoon || 0;

      // Get batch ID for filtering
      const activeBatch = await db
        .select()
        .from(batches)
        .where(eq(batches.isActive, 1))
        .then((rows) => rows[0]);

      const conditions = [eq(corpsMembers.platoon, platoon)];
      if (activeBatch) {
        conditions.push(eq(corpsMembers.batchId, activeBatch.id));
      }

      const totalMembers = await db
        .select({ count: sql<number>`count(*)` })
        .from(corpsMembers)
        .where(and(...conditions))
        .then((r) => r[0].count);

      // Count evaluated/commented based on role
      const members = await db
        .select({ id: corpsMembers.id })
        .from(corpsMembers)
        .where(and(...conditions));

      let processedCount = 0;
      for (const m of members) {
        if (user.role === "platoon_instructor") {
          const ev = await db
            .select()
            .from(evaluations)
            .where(
              and(
                eq(evaluations.corpsMemberId, m.id),
                eq(evaluations.evaluatorRole, "platoon_instructor")
              )
            )
            .then((rows) => rows[0]);
          if (ev) processedCount++;
        } else if (user.role === "man_o_war_instructor") {
          const ev = await db
            .select()
            .from(evaluations)
            .where(
              and(
                eq(evaluations.corpsMemberId, m.id),
                eq(evaluations.evaluatorRole, "man_o_war_instructor")
              )
            )
            .then((rows) => rows[0]);
          if (ev) processedCount++;
        } else if (user.role === "soldier") {
          const cm = await db
            .select()
            .from(comments)
            .where(
              and(
                eq(comments.corpsMemberId, m.id),
                eq(comments.soldierId, user.id)
              )
            )
            .then((rows) => rows[0]);
          if (cm) processedCount++;
        }
      }

      stats.totalMembers = totalMembers;
      stats.processedCount = processedCount;
      stats.pendingCount = totalMembers - processedCount;
    }

    return stats;
  }),
});
