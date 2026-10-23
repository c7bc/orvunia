import { z } from "zod";

export const conversationInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    mode: z.enum(["recruiter", "technical"]),
  })
  .strict();
export const conversationParams = z.object({ id: z.uuid() });
export const notesInput = z
  .object({
    text: z.string().max(100_000),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export const conversationQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: z.uuid().optional(),
  })
  .strict();
