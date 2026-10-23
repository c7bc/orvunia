import { createHmac, timingSafeEqual } from "node:crypto";
import { isAbsolute } from "node:path";
import { z } from "zod";
import { modelDownloadInput } from "./contracts.ts";
import { LocalModelError } from "./domain.ts";

export const nativeSelection = modelDownloadInput.extend({
  actor: z.string().regex(/^[0-9]{1,20}$/),
  origin: z.url().max(200),
  path: z.string().min(1).max(4096).refine(value => isAbsolute(value) && !value.includes("\0")),
  nonce: z.uuid(), expiresAt: z.number().int().positive(),
}).strict();
export const nativeSelectionEnvelope = z.object({ selection: nativeSelection,
  signature: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export function signNativeSelection(input: z.infer<typeof nativeSelection>, token: string) {
  const selection = nativeSelection.parse(input);
  return { selection, signature: createHmac("sha256", token)
    .update("orvunia.native-model-import/v1\0").update(JSON.stringify(selection)).digest("hex") };
}
export function nativeSelectionVerifier(token: string, origin: string, clock = Date.now) {
  const used = new Map<string, number>();
  return (input: unknown) => {
    const envelope = nativeSelectionEnvelope.parse(input);
    const { selection, signature } = envelope;
    const now = clock();
    for (const [nonce, expiry] of used) if (expiry < now) used.delete(nonce);
    const expected = signNativeSelection(selection, token).signature;
    if (selection.origin !== origin || selection.expiresAt < now || selection.expiresAt > now + 30_000 ||
        used.has(selection.nonce) || used.size >= 1024 ||
        !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex")))
      throw new LocalModelError("selection_invalid", 403);
    used.set(selection.nonce, selection.expiresAt);
    return selection;
  };
}
