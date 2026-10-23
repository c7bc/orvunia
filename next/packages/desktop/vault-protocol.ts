import { z } from "zod";
export const parentNonce = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const shared = { nonce: parentNonce, requestId: z.uuid() };
export const vaultRequest = z
  .object({
    ...shared,
    type: z.literal("vault_request"),
    operation: z.enum(["seal", "open"]),
    value: z.string().min(1).max(60000),
  })
  .strict();
export const vaultResult = z.discriminatedUnion("ok", [
  z
    .object({
      ...shared,
      type: z.literal("vault_result"),
      ok: z.literal(true),
      value: z.string().max(60000),
    })
    .strict(),
  z
    .object({
      ...shared,
      type: z.literal("vault_result"),
      ok: z.literal(false),
    })
    .strict(),
]);
export type VaultRequest = z.infer<typeof vaultRequest>;
export type VaultResult = z.infer<typeof vaultResult>;
