import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

// Imprints router
export const imprintsRouter = router({
  getByGroup: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input }) => {
      return await db.getImprintsByGroup(input.groupId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        location: z.string().optional(),
        decorationMethod: z.string().optional(),
        colors: z.number().optional(),
        stitchCount: z.number().optional(),
        artworkUrl: z.string().optional(),
        setupFee: z.string().optional(),
        unitPrice: z.string().optional(),
        notes: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await db.createImprint(input);
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        location: z.string().optional(),
        decorationMethod: z.string().optional(),
        colors: z.number().optional(),
        stitchCount: z.number().optional(),
        artworkUrl: z.string().optional(),
        setupFee: z.string().optional(),
        unitPrice: z.string().optional(),
        notes: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateImprint(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.deleteImprint(input.id);
      return { success: true };
    }),
});

