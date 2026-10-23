import { z } from "zod";
export const modeSchema = z.enum(["recruiter", "technical"]);
export const modeIdSchema = z.union([modeSchema, z.string().uuid()]);
export const noteSectionSchema = z
  .object({
    title: z.string().trim().max(80),
    instructions: z.string().max(3000),
  })
  .strict();
export const customModeSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    base: modeSchema,
    systemPrompt: z.string().max(32768).optional(),
    instructions: z.string().max(65536).default(""),
    sections: z.array(noteSectionSchema).max(12).default([]),
    documents: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1).max(160),
            text: z.string().max(30000),
            date: z.string().max(40),
          })
          .strict(),
      )
      .max(15)
      .default([]),
  })
  .strict();
// Omitted PATCH fields must stay omitted: Zod 4 otherwise applies inner defaults.
export const customModePatchSchema = customModeSchema
  .extend({
    instructions: customModeSchema.shape.instructions.removeDefault(),
    sections: customModeSchema.shape.sections.removeDefault(),
    documents: customModeSchema.shape.documents.removeDefault(),
  })
  .partial();

export const createModeInput = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    base: modeSchema.optional(),
    templateId: z.string().max(80).optional(),
  })
  .strict();
export const modeParams = z.object({ modeId: modeIdSchema });
