import { z } from "zod";
export const followupAddress = z
  .email()
  .max(254)
  .refine((value) => !/[\r\n]/.test(value));
export const followupDraft = z
  .object({
    recipient: z.union([followupAddress, z.literal("")]).default(""),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((value) => !/[\r\n]/.test(value)),
    body: z.string().trim().min(1).max(30000),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const followupSend = z
  .object({
    revision: z.number().int().positive(),
    requestId: z.uuid(),
    confirmation: z.literal("send"),
  })
  .strict();
