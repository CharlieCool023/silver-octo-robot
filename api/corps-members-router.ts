import { z } from "zod";
import { createRouter, publicQuery, staffQuery, adminOrCommandantQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { corpsMembers, higherInstitutions, evaluations, comments, commandantComments, batches } from "@db/schema";
import { eq, like, and, or, desc, sql } from "drizzle-orm";

export const corpsMembersRouter = createRouter({
  // List corps members with filters
  list: staffQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          platoon: z.number().optional(),
          batchId: z.number().optional(),
          evaluationStatus: z.string().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [];

      // Always filter by active batch
      const activeBatch = await db
        .select()
        .from(batches)
        .where(eq(batches.isActive, 1))
        .then((rows) => rows[0]);

      if (!activeBatch) {
        // No active batch - return empty list with message
        return [];
      }

      conditions.push(eq(corpsMembers.batchId, activeBatch.id));

      if (input?.search) {
        conditions.push(
          or(
            like(corpsMembers.surname, `%${input.search}%`),
            like(corpsMembers.otherNames, `%${input.search}%`),
            like(corpsMembers.stateCode, `%${input.search}%`),
            like(corpsMembers.callUpNumber, `%${input.search}%`)
          )
        );
      }
      if (input?.platoon) {
        conditions.push(eq(corpsMembers.platoon, input.platoon));
      }

      // Instructors/soldiers only see their platoon
      if (
        ctx.staffUser!.role === "platoon_instructor" ||
        ctx.staffUser!.role === "man_o_war_instructor" ||
        ctx.staffUser!.role === "soldier"
      ) {
        conditions.push(eq(corpsMembers.platoon, ctx.staffUser!.assignedPlatoon || 0));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const members = await (where
        ? db
            .select()
            .from(corpsMembers)
            .where(where)
            .limit(input?.limit || 50)
            .offset(input?.offset || 0)
            .orderBy(desc(corpsMembers.createdAt))
        : db
            .select()
            .from(corpsMembers)
            .limit(input?.limit || 50)
            .offset(input?.offset || 0)
            .orderBy(desc(corpsMembers.createdAt)));

      // Get evaluation status for each member
      const membersWithStatus = await Promise.all(
        members.map(async (member) => {
          const piEval = await db
            .select()
            .from(evaluations)
            .where(
              and(
                eq(evaluations.corpsMemberId, member.id),
                eq(evaluations.evaluatorRole, "platoon_instructor")
              )
            )
            .then((rows) => rows[0]);

          const mowEval = await db
            .select()
            .from(evaluations)
            .where(
              and(
                eq(evaluations.corpsMemberId, member.id),
                eq(evaluations.evaluatorRole, "man_o_war_instructor")
              )
            )
            .then((rows) => rows[0]);

          const soldierComments = await db
            .select()
            .from(comments)
            .where(eq(comments.corpsMemberId, member.id));

          const cmdComments = await db
            .select()
            .from(commandantComments)
            .where(eq(commandantComments.corpsMemberId, member.id));

          return {
            ...member,
            evaluationStatus: {
              platoonInstructor: !!piEval,
              manOWar: !!mowEval,
              soldierComment: soldierComments.length > 0,
              commandantComment: cmdComments.length > 0,
              piScore: piEval?.overallAverage,
              mowScore: mowEval?.overallAverage,
            },
          };
        })
      );

      return membersWithStatus;
    }),

  // Get single corps member with all details
  get: staffQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      
      // Verify active batch exists
      const activeBatch = await db
        .select()
        .from(batches)
        .where(eq(batches.isActive, 1))
        .then((rows) => rows[0]);

      const member = await db
        .select()
        .from(corpsMembers)
        .where(eq(corpsMembers.id, input.id))
        .then((rows) => rows[0]);

      if (!member || !activeBatch || member.batchId !== activeBatch.id) {
        return null;
      }

      const institutions = await db
        .select()
        .from(higherInstitutions)
        .where(eq(higherInstitutions.corpsMemberId, member.id));

      const piEval = await db
        .select()
        .from(evaluations)
        .where(
          and(
            eq(evaluations.corpsMemberId, member.id),
            eq(evaluations.evaluatorRole, "platoon_instructor")
          )
        )
        .then((rows) => rows[0]);

      const mowEval = await db
        .select()
        .from(evaluations)
        .where(
          and(
            eq(evaluations.corpsMemberId, member.id),
            eq(evaluations.evaluatorRole, "man_o_war_instructor")
          )
        )
        .then((rows) => rows[0]);

      const soldierComments = await db
        .select()
        .from(comments)
        .where(eq(comments.corpsMemberId, member.id));

      const cmdComments = await db
        .select()
        .from(commandantComments)
        .where(eq(commandantComments.corpsMemberId, member.id));

      return {
        ...member,
        institutions,
        evaluations: {
          platoonInstructor: piEval,
          manOWar: mowEval,
        },
        comments: soldierComments,
        commandantComments: cmdComments,
        evaluationStatus: {
          platoonInstructor: !!piEval,
          manOWar: !!mowEval,
          soldierComment: soldierComments.length > 0,
          commandantComment: cmdComments.length > 0,
          piScore: piEval?.overallAverage,
          mowScore: mowEval?.overallAverage,
        },
      };
    }),

  // Register corps member (public - no login required)
  register: publicQuery
    .input(
      z.object({
        passportPhoto: z.string().optional(),
        surname: z.string().min(1),
        otherNames: z.string().min(1),
        changedName: z.number().default(0),
        formerName: z.string().optional(),
        state: z.enum(["ondo", "lagos"]),
        stateCode: z
          .string()
          .regex(/^(OD|LA)\/\d{2}[A-C]\/[0-9]{4}$/, "Invalid state code format"),
        callUpNumber: z
          .string()
          .regex(
            /^NYSC\/[A-Z]{2,4}\/\d{4}\/[0-9]{5}$/,
            "Invalid call-up number format"
          ),
        phoneNumber: z
          .string()
          .regex(/^234[0-9]{10}$/, "Phone must start with 234 and be 13 digits total"),
        stateOfOrigin: z.string().min(1),
        stateOfDeployment: z.enum(["ondo", "lagos"]),
        qualification: z.string().min(1),
        areaOfSpecialization: z.string().min(1),
        platoon: z.number().min(1).max(10),
        campExperienceComment: z.string().optional(),
        institutions: z
          .array(
            z.object({
              institutionName: z.string().min(1),
              startDate: z.string(),
              endDate: z.string(),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get active batch (required for registration)
      const activeBatch = await db
        .select()
        .from(batches)
        .where(eq(batches.isActive, 1))
        .then((rows) => rows[0]);

      if (!activeBatch) {
        throw new Error("No active batch available for registration");
      }

      // Check for duplicates
      const existingCode = await db
        .select()
        .from(corpsMembers)
        .where(eq(corpsMembers.stateCode, input.stateCode))
        .then((rows) => rows[0]);

      if (existingCode) {
        throw new Error("State code already registered");
      }

      const existingCallUp = await db
        .select()
        .from(corpsMembers)
        .where(eq(corpsMembers.callUpNumber, input.callUpNumber))
        .then((rows) => rows[0]);

      if (existingCallUp) {
        throw new Error("Call-up number already registered");
      }

      const result = await db.insert(corpsMembers).values({
        passportPhoto: input.passportPhoto,
        surname: input.surname.toUpperCase(),
        otherNames: input.otherNames.toUpperCase(),
        changedName: input.changedName as 0 | 1,
        formerName: input.formerName,
        state: input.state,
        stateCode: input.stateCode.toUpperCase(),
        callUpNumber: input.callUpNumber.toUpperCase(),
        phoneNumber: input.phoneNumber,
        stateOfOrigin: input.stateOfOrigin,
        stateOfDeployment: input.stateOfDeployment,
        qualification: input.qualification,
        areaOfSpecialization: input.areaOfSpecialization,
        platoon: input.platoon,
        campExperienceComment: input.campExperienceComment,
        batchId: activeBatch.id,
      });

      const memberId = Number(result[0].insertId);

      // Insert institutions
      for (const inst of input.institutions) {
        await db.insert(higherInstitutions).values({
          corpsMemberId: memberId,
          institutionName: inst.institutionName,
          startDate: new Date(inst.startDate),
          endDate: new Date(inst.endDate),
        });
      }

      return { success: true, id: memberId };
    }),

  // Get corps member count for a batch
  count: staffQuery
    .input(z.object({ batchId: z.number() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const result = input?.batchId
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(corpsMembers)
            .where(eq(corpsMembers.batchId, input.batchId))
        : await db.select({ count: sql<number>`count(*)` }).from(corpsMembers);
      return result[0]?.count || 0;
    }),

  // Add commandant comment
  addCommandantComment: adminOrCommandantQuery
    .input(
      z.object({
        corpsMemberId: z.number(),
        comment: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Verify corps member belongs to active batch
      const activeBatch = await db
        .select()
        .from(batches)
        .where(eq(batches.isActive, 1))
        .then((rows) => rows[0]);

      if (!activeBatch) throw new Error("No active batch");

      const member = await db
        .select()
        .from(corpsMembers)
        .where(eq(corpsMembers.id, input.corpsMemberId))
        .then((rows) => rows[0]);

      if (!member || member.batchId !== activeBatch.id) {
        throw new Error("Corps member not found in active batch");
      }

      await db.insert(commandantComments).values({
        corpsMemberId: input.corpsMemberId,
        commandantId: ctx.staffUser!.id,
        comment: input.comment,
      });
      return { success: true };
    }),

  // Check if state code exists (for registration validation)
  checkStateCode: publicQuery
    .input(z.object({ stateCode: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(corpsMembers)
        .where(eq(corpsMembers.stateCode, input.stateCode.toUpperCase()))
        .then((rows) => rows[0]);
      return { exists: !!existing };
    }),

  // Check if call-up number exists
  checkCallUpNumber: publicQuery
    .input(z.object({ callUpNumber: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(corpsMembers)
        .where(eq(corpsMembers.callUpNumber, input.callUpNumber.toUpperCase()))
        .then((rows) => rows[0]);
      return { exists: !!existing };
    }),

  // Delete corps member (camp commandant only)
  delete: adminOrCommandantQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Verify active batch exists and corps member belongs to it
      const activeBatch = await db
        .select()
        .from(batches)
        .where(eq(batches.isActive, 1))
        .then((rows) => rows[0]);

      if (!activeBatch) {
        throw new Error("No active batch");
      }

      const member = await db
        .select()
        .from(corpsMembers)
        .where(eq(corpsMembers.id, input.id))
        .then((rows) => rows[0]);

      if (!member || member.batchId !== activeBatch.id) {
        throw new Error("Corps member not found in active batch");
      }

      // Delete all related records first
      await db.delete(evaluations).where(eq(evaluations.corpsMemberId, input.id));
      await db.delete(comments).where(eq(comments.corpsMemberId, input.id));
      await db.delete(commandantComments).where(eq(commandantComments.corpsMemberId, input.id));
      await db.delete(higherInstitutions).where(eq(higherInstitutions.corpsMemberId, input.id));

      // Delete the member
      await db.delete(corpsMembers).where(eq(corpsMembers.id, input.id));

      return { success: true };
    }),
});
