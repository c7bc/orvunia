import { FollowupError, publicDelivery } from "./domain.ts";
import type { DraftInput, Delivery } from "./domain.ts";
import { draftHash } from "./decisions.ts";
import { followupAddress } from "../contracts/followups.ts";
import type { FollowupRepository } from "./repository.ts";
import type { FollowupCipher } from "./cipher.ts";
import type { SessionRepository } from "../sessions/repository.ts";
import type { Locale } from "../i18n/messages.ts";
import { followupEmail } from "./template.ts";
export type FollowupSettings = {
  enabled: boolean;
  configured: boolean;
  sender: string;
  dailyLimit: number;
};
export function followups(dependencies: {
  repository: FollowupRepository;
  sessions: Pick<SessionRepository, "find">;
  cipher: FollowupCipher;
  settings: FollowupSettings;
  clock(): number;
  identifier(): string;
}) {
  const { repository, settings, clock } = dependencies;
  async function own(workspaceId: string, conversationId: string) {
    if (!(await dependencies.sessions.find(workspaceId, conversationId)))
      throw new FollowupError("conversation_not_found", 404);
  }
  return {
    async get(workspaceId: string, conversationId: string) {
      await own(workspaceId, conversationId);
      const [draft, delivery] = await Promise.all([
        repository.draft(workspaceId, conversationId),
        repository.latest(workspaceId, conversationId),
      ]);
      return {
        draft,
        delivery: publicDelivery(delivery, clock()),
        sending: {
          configured: settings.configured,
          sender: settings.sender,
          dailyLimit: settings.dailyLimit,
          allowed: settings.enabled && settings.configured,
          reason: !settings.enabled
            ? "disabled"
            : !settings.configured
              ? "not-configured"
              : "ready",
        },
      };
    },
    async save(workspaceId: string, conversationId: string, input: DraftInput) {
      await own(workspaceId, conversationId);
      return {
        draft: await repository.save(
          workspaceId,
          conversationId,
          input,
          new Date(clock()).toISOString(),
        ),
      };
    },
    async send(
      workspaceId: string,
      conversationId: string,
      input: { revision: number; requestId: string },
      locale: Locale,
    ) {
      await own(workspaceId, conversationId);
      const receipt = await repository.receipt(workspaceId, input.requestId);
      if (receipt) {
        if (
          receipt.conversationId !== conversationId ||
          receipt.revision !== input.revision
        )
          throw new FollowupError("followup_conflict");
        return { delivery: publicDelivery(receipt, clock()), repeated: true };
      }
      if (!settings.enabled || !settings.configured)
        throw new FollowupError("followup_disabled", 503);
      const draft = await repository.draft(workspaceId, conversationId);
      if (!draft || draft.revision !== input.revision)
        throw new FollowupError("followup_conflict");
      if (!followupAddress.safeParse(draft.recipient).success)
        throw new FollowupError("invalid_input", 400);
      const now = clock();
      const candidate: Delivery = {
        id: dependencies.identifier(),
        workspaceId,
        conversationId,
        revision: input.revision,
        requestId: input.requestId,
        draftHash: draftHash(draft),
        state: "pending",
        providerId: "",
        createdAt: now,
        ciphertext: await dependencies.cipher.seal(
          await followupEmail(draft, locale),
        ),
        expiresAt: now + 86400000,
        claimedAt: null,
        attempts: 0,
        retryAt: 0,
      };
      const result = await repository.queue(candidate, settings.dailyLimit);
      return {
        delivery: publicDelivery(result.delivery, clock()),
        repeated: result.repeated,
      };
    },
  };
}
export type FollowupService = ReturnType<typeof followups>;
