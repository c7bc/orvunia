import { z } from "zod";
export const indexQuery = z
  .object({
    before: z.string().max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).default(""),
  })
  .strict();
export const indexCursor = z
  .object({
    owner: z.string().min(1).max(200),
    kind: z.literal("index"),
    date: z.string().max(80),
    id: z.uuid(),
    search: z.string().max(200),
  })
  .strict();
