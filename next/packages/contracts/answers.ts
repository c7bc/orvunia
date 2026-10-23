import { z } from "zod";
import { modeSchema } from "./modes.ts";
import { codeLanguages } from "./workspace.ts";
export const sourceTranscriptIdsSchema = z.array(z.uuid()).max(80)
  .refine(ids => new Set(ids).size === ids.length, "Não repita falas.");
export const answerSchema = z
  .object({
    requestId: z.string().uuid(),
    mode: modeSchema,
    action: z.enum([
      "assist",
      "followup",
      "star",
      "recap",
      "custom",
      "hint",
      "debug",
      "design",
      "email",
      "tests",
      "optimize",
      "explain",
    ]),
    question: z.string().max(6000).default(""),
    sourceTranscriptIds: sourceTranscriptIdsSchema.optional(),
    problem: z.string().max(30000).default(""),
    codeLanguage: z.enum(codeLanguages).optional(),
    captureIds: z
      .array(z.string().uuid())
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length, "Não repita capturas.")
      .optional(),
  })
  .strict();

export type AnswerInput = z.infer<typeof answerSchema>;
