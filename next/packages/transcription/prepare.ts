import { createHash } from "node:crypto";
import type { RecordedAudio } from "./domain.ts";
import { validateRecordedAudio } from "./validation.ts";
import type { TranscriptionDependencies } from "./dependencies.ts";
import { pcmDuration } from "./duration.ts";
import type { Operation } from "../operations/domain.ts";
import { OperationError } from "../operations/domain.ts";
import { ProviderError } from "../providers/domain.ts";
import { capabilityProvider } from "../capabilities/snapshot.ts";
import { legacyProviderReady } from "../providers/legacy-ready.ts";
import { transcriptionHints } from "./vocabulary.ts";

export async function prepareTranscription(
  dependencies: TranscriptionDependencies,
  workspaceId: string,
  conversationId: string,
  input: RecordedAudio,
) {
  validateRecordedAudio(input);
  const session = await dependencies.sessions.find(workspaceId, conversationId);
  if (!session) throw new OperationError("conversation_not_found");
  const id = createHash("sha256")
    .update(`${conversationId}:${input.segmentId}`)
    .digest("hex");
  const requestHash = createHash("sha256")
    .update(input.data)
    .update(
      JSON.stringify({
        mime: input.mime,
        who: input.who,
        time: input.time,
        language: input.language ?? null,
      }),
    )
    .digest("hex");
  const existing = await dependencies.operations.find(
    workspaceId,
    "transcription",
    id,
  );
  if (
    existing?.state === "unknown" &&
    existing.requestHash === "legacy-unavailable"
  )
    throw new OperationError("operation_unknown");
  if (
    existing &&
    (existing.requestHash !== requestHash ||
      existing.conversationId !== conversationId)
  )
    throw new OperationError("request_conflict");
  if (
    (!dependencies.capabilities || existing?.snapshot?.version === 1) && existing?.state !== "completed" &&
    !legacyProviderReady(dependencies.providers, "transcription")
  )
    throw new ProviderError("provider_not_configured", 503);
  const workspace = await dependencies.workspace.find(workspaceId);
  const provider = dependencies.providers.effective("transcription");
  const capabilities = !existing && dependencies.capabilities ? await dependencies.capabilities.resolvePlan() : null;
  const durationSeconds = dependencies.local ? 1 : pcmDuration(input.data);
  const now = dependencies.clock();
  const candidate: Operation = {
    id,
    kind: "transcription",
    workspaceId,
    conversationId,
    requestHash,
    state: "prepared",
    attempt: 1,
    snapshotBytes: 0,
    result: null,
    reservationId: null,
    lease: dependencies.identifier(),
    leaseUntil: now + 90_000,
    expiresAt: now + 24 * 60 * 60_000,
    createdAt: now,
    cancelRequested: false,
    providerStarted: false,
    partial: false,
    snapshot: existing
      ? existing.snapshot
      : {
          ...(capabilities ? { version: 2 as const, capabilities } : { version: 1 as const }),
          allowEnded: false,
          historyGeneration: session.historyGeneration,
          images: [],
          provider: capabilities ? capabilityProvider(capabilities, "transcription") : {
            provider: provider.provider,
            baseUrl: provider.baseUrl,
            model: provider.model,
            vision: false,
            maxTokens: 0,
          },
          instructions: transcriptionHints(input.language ?? workspace.preferences.audio,
            workspace.profile?.tags ?? "", session.mode === "technical").prompt,
          context: JSON.stringify({
            language: input.language ?? workspace.preferences.audio,
          }),
          metadata: {
            action: "transcribe",
            mode: session.mode,
            question: "",
            who: input.who,
            time: input.time,
            segmentId: input.segmentId,
            durationSeconds,
            measuredDuration: !dependencies.local,
          },
        },
  };
  const operation = await dependencies.operations.claim(candidate);
  if (operation.state === "unknown")
    throw new OperationError("operation_unknown");
  return operation;
}
