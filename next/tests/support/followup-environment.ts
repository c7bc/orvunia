import type {
  FollowupRepository,
  FollowupOutbox,
} from "../../packages/followups/repository.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
import {
  followupCipher,
  managedFollowupVault,
} from "../../packages/followups/cipher.ts";
import type { FollowupCipher } from "../../packages/followups/cipher.ts";
import { followups } from "../../packages/followups/service.ts";
export type FollowupFixture = () => Promise<{
  repository: FollowupRepository;
  sessions: SessionRepository;
  outbox(cipher: FollowupCipher, clock: () => number): FollowupOutbox;
}>;
export async function followupEnvironment(fixture: FollowupFixture) {
  const adapters = await fixture(),
    owner = crypto.randomUUID();
  let now = Date.now();
  const cipher = followupCipher(
    managedFollowupVault(
      "synthetic-followup-secret-over-thirty-two-characters",
    ),
  );
  const dependencies = {
    ...adapters,
    cipher,
    settings: {
      enabled: true,
      configured: true,
      sender: "sender@example.test",
      dailyLimit: 20,
    },
    clock: () => now,
    identifier: () => crypto.randomUUID(),
  };
  const service = followups(dependencies),
    outbox = adapters.outbox(cipher, () => now);
  const create = async () =>
    adapters.sessions.create({
      id: crypto.randomUUID(),
      workspaceId: owner,
      title: "Synthetic follow-up",
      mode: "recruiter",
      state: "ended",
      createdAt: new Date(now).toISOString(),
      elapsed: 1,
      question: "",
      modeSnapshot: null,
      historyGeneration: 0,
      revision: 0,
    });
  const session = await create();
  const input = {
    recipient: "recipient@example.test",
    subject: "Thank you",
    body: "Hello <script>unsafe()</script>\nThanks!",
    expectedRevision: 0,
  };
  return {
    ...adapters,
    owner,
    session,
    service,
    outbox,
    cipher,
    dependencies,
    input,
    create,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    save: () => service.save(owner, session.id, input),
    send: (revision = 1, requestId = crypto.randomUUID()) =>
      service.send(owner, session.id, { revision, requestId }, "en"),
    status: () => service.get(owner, session.id),
    replica: () => followups(dependencies),
  };
}
