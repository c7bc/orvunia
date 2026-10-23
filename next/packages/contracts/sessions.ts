import { z } from "zod";
import { modeIdSchema, modeSchema } from "./modes.ts";

export const sessionInput = z
  .object({
    mode: modeSchema,
    modeId: modeIdSchema.optional(),
    title: z.string().min(1).max(200),
  })
  .strict();
export const sessionPatch = z
  .object({
    title: z.string().min(1).max(200).optional(),
    mode: modeSchema.optional(),
    modeId: modeIdSchema.optional(),
    state: z.enum(["active", "paused", "ended"]).optional(),
    elapsed: z.number().int().min(0).max(86400).optional(),
  })
  .strict();
export const transcriptInput = z
  .object({
    text: z.string().trim().min(1).max(16000),
    who: z.string().trim().min(1).max(60),
    time: z.string().regex(/^\d{2,3}:\d{2}$/),
    source: z.enum(["manual", "audio", "sample"]).default("manual"),
    segmentId: z.string().uuid().optional(),
  })
  .strict();
export const historyKind = z.enum(["transcripts", "responses", "captures"]);
export const historyQuery = z
  .object({
    kind: historyKind,
    before: z.string().max(2048).optional(),
    after: z.string().max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((query) => !(query.before && query.after));
export const sessionQuery = z
  .object({
    before: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict();
