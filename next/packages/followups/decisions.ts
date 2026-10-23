import { createHash } from "node:crypto";
import type { Delivery, Draft } from "./domain.ts";
import { FollowupError } from "./domain.ts";
export const draftHash = (draft: Draft) =>
  createHash("sha256")
    .update(JSON.stringify([draft.recipient, draft.subject, draft.body]))
    .digest("hex");
export function decideDelivery(
  candidate: Delivery,
  context: {
    request: Delivery | null;
    previous: Delivery | null;
    draft: Draft | null;
    used: number;
    dailyLimit: number;
  },
) {
  if (context.request) {
    if (
      context.request.conversationId !== candidate.conversationId ||
      context.request.revision !== candidate.revision
    )
      throw new FollowupError("followup_conflict");
    return { delivery: context.request, repeated: true };
  }
  if (
    !context.draft ||
    context.draft.revision !== candidate.revision ||
    draftHash(context.draft) !== candidate.draftHash
  )
    throw new FollowupError("followup_conflict");
  if (context.previous) return { delivery: context.previous, repeated: true };
  if (context.used >= context.dailyLimit)
    throw new FollowupError("followup_limit", 429);
  return { delivery: candidate, repeated: false };
}
