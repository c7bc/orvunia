import { z } from "zod";
export const expansionParams = z.object({ id: z.uuid(), responseId: z.uuid() });
export const expansionPrepare = z
  .object({ requestId: z.uuid(), consent: z.literal(true) })
  .strict();
export const expansionRequest = z.object({ requestId: z.uuid() }).strict();
