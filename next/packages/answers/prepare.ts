import { createHash } from "node:crypto";
import type { AnswerDependencies } from "./dependencies.ts";
import type { AnswerInput } from "../contracts/answers.ts";
import type { Operation } from "../operations/domain.ts";
import { OperationError } from "../operations/domain.ts";
import { ProviderError } from "../providers/domain.ts";
import { canonicalEndpoint } from "../providers/presets.ts";
import { answerContext } from "./context.ts";
import type { AnswerPreparationOptions } from "./preparation.ts";
import { legacyProviderReady } from "../providers/legacy-ready.ts";

export async function prepareAnswer(
  dependencies: AnswerDependencies,
  workspaceId: string,
  conversationId: string,
  input: AnswerInput,
  allowEnded: boolean,
  options: AnswerPreparationOptions = {},
) {
  const { operations, providers, clock, identifier } = dependencies;
  const requestHash = createHash("sha256")
    .update(options.requestFingerprint ?? JSON.stringify(input))
    .digest("hex");
  const existing = await operations.find(
    workspaceId,
    "answer",
    input.requestId,
  );
  if (
    existing &&
    (existing.requestHash !== requestHash ||
      existing.conversationId !== conversationId)
  )
    throw new OperationError("request_conflict");
  if ((!dependencies.capabilities || existing?.snapshot?.version === 1) &&
      existing?.state !== "completed" && !legacyProviderReady(providers, "response"))
    throw new ProviderError("provider_not_configured", 503);
  if (existing?.snapshot?.version === 1 && existing.state !== "completed") {
    const current = providers.effective("response"),
      original = existing.snapshot.provider;
    if (
      current.provider !== original.provider ||
      canonicalEndpoint(current.baseUrl) !== canonicalEndpoint(original.baseUrl)
    )
      throw new ProviderError("original_provider_changed", 409);
  }
  const now = clock();
  const candidate: Operation = {
    id: input.requestId,
    kind: "answer",
    workspaceId,
    conversationId,
    requestHash,
    state: "prepared",
    attempt: 1,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60_000,
    lease: identifier(),
    leaseUntil: now + 90_000,
    providerStarted: false,
    cancelRequested: false,
    partial: false,
    reservationId: null,
    result: null,
    snapshotBytes: 0,
    snapshot: existing
      ? existing.snapshot
      : await answerContext(
          dependencies,
          workspaceId,
          conversationId,
          input,
          allowEnded,
          options,
        ),
  };
  const operation = await operations.claim(candidate);
  if (operation.state === "unknown")
    throw new OperationError("operation_unknown");
  return operation;
}
