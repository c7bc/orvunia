import { dirname, join } from "node:path";
import type { LocalSettings } from "../../packages/config/local.ts";
import type { Composition } from "./composition.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import type {
  FollowupRepository,
  FollowupOutbox,
} from "../../packages/followups/repository.ts";
import { followups } from "../../packages/followups/service.ts";
import { followupConfig } from "../../packages/followups/config.ts";
import {
  followupCipher,
} from "../../packages/followups/cipher.ts";
import type { FollowupCipher } from "../../packages/followups/cipher.ts";
import { followupDispatcher } from "../../packages/followups/dispatcher.ts";
import { smtpTransport } from "../../packages/followups/smtp.ts";
import { fileVault } from "../../packages/providers/vault.ts";
export function composeFollowups(
  settings: LocalSettings,
  composition: Composition,
  sessions: SessionRepository,
  repository: FollowupRepository,
  outbox: (cipher: FollowupCipher) => FollowupOutbox,
) {
  const config = followupConfig(composition.environment, "");
  const vault =
    composition.vault
        ? {
            seal: (value: string) =>
              composition.vault!.seal("cadence.followup/v1\0" + value),
            async open(value: string) {
              const clear = await composition.vault!.open(value),
                prefix = "cadence.followup/v1\0";
              if (!clear.startsWith(prefix))
                throw Error("Invalid follow-up secret scope");
              return clear.slice(prefix.length);
            },
          }
        : fileVault(
            join(dirname(settings.CADENCE_SQLITE_PATH), "followup.next.key"),
            "cadence.followup/v1",
            1_000_000,
          );
  const cipher = followupCipher(vault);
  const service = followups({
    repository,
    sessions,
    cipher,
    settings: config,
    clock: Date.now,
    identifier: () => crypto.randomUUID(),
  });
  const dispatcher =
    config.smtp
      ? followupDispatcher(outbox(cipher), smtpTransport(config.smtp), () =>
          composition.log({ event: "followup_dispatch_failed" }),
        )
      : null;
  return {
    service,
    close: async () => {
      await dispatcher?.close();
    },
  };
}
