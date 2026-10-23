import { createHash } from "node:crypto";
import type { AnswerDependencies } from "./dependencies.ts";
import type { Operation } from "../operations/domain.ts";
import { executeOperation } from "../operations/execute.ts";
import { generation } from "../providers/generation.ts";
import { ProviderError } from "../providers/domain.ts";
import { canonicalEndpoint } from "../providers/presets.ts";
import { capabilityAnswer } from "./capability-run.ts";
import { legacyProviderReady } from "../providers/legacy-ready.ts";
import { validateTranscriptSources } from "./transcript-sources.ts";
import { prepareInvocation } from "../operations/preparation-error.ts";

export function runAnswer(
  dependencies: AnswerDependencies,
  operation: Operation,
  signal: AbortSignal,
  delta: (text: string) => void,
  authorized: () => Promise<boolean>,
) {
  return executeOperation(dependencies, operation, signal, authorized, {
    kind: "answers",
    units: 1,
    replay: (result) => delta(result.text),
    async prepare(combined) {
      const snapshot = operation.snapshot;
      if (!snapshot) throw new ProviderError("provider_unavailable");
      await validateTranscriptSources(dependencies.sessions, operation.workspaceId, operation.conversationId,
        snapshot.metadata.sourceTranscriptIds, snapshot.historyGeneration, snapshot.allowEnded);
      if (snapshot.version === 1 && !legacyProviderReady(dependencies.providers, "response"))
        throw new ProviderError("provider_not_configured", 503);
      if (snapshot.version === 2) {
        if (!dependencies.capabilities) throw new ProviderError("provider_unavailable");
        await dependencies.capabilities.validate(snapshot.capabilities, snapshot.images.length ? ["text", "vision"] : ["text"]);
      }
      const current = dependencies.providers.effective("response"),
        original = snapshot.provider;
      if (snapshot.version === 1 && (
        current.provider !== original.provider ||
        canonicalEndpoint(current.baseUrl) !==
          canonicalEndpoint(original.baseUrl)
      ))
        throw new ProviderError("original_provider_changed", 409);
      const images = await Promise.all(
        snapshot.images.map(async (image) => {
          const data = await dependencies.objects.get(
            image.key,
            image.bytes,
            combined,
          );
          if (createHash("sha256").update(data).digest("hex") !== image.hash)
            throw new ProviderError("provider_unavailable");
          return { mime: image.mime, data };
        }),
      );
      const provider = generation(
        {
          ...current,
          model: original.model,
          vision: original.vision,
          maxTokens: original.maxTokens,
        },
        dependencies.transport,
      );
      return async (partial) => {
        await prepareInvocation(() => validateTranscriptSources(dependencies.sessions, operation.workspaceId,
          operation.conversationId, snapshot.metadata.sourceTranscriptIds, snapshot.historyGeneration, snapshot.allowEnded));
        if (snapshot.version === 2) {
          const result = await capabilityAnswer(dependencies, operation, snapshot, images, combined, delta, partial);
          return { id: operation.id, ...result, captureIds: snapshot.images.map((image) => image.id),
            ...(snapshot.metadata.sourceTranscriptIds ? { sourceTranscriptIds: [...snapshot.metadata.sourceTranscriptIds] } : {}) };
        }
        const result = await provider.answer(
          {
            instructions: snapshot.instructions,
            context: snapshot.context,
            images,
          },
          combined,
          (text) => {
            combined.throwIfAborted();
            if (text) partial();
            delta(text);
          },
        );
        return {
          id: operation.id,
          ...result,
          captureIds: snapshot.images.map((image) => image.id),
          ...(snapshot.metadata.sourceTranscriptIds ? { sourceTranscriptIds: [...snapshot.metadata.sourceTranscriptIds] } : {}),
        };
      };
    },
  });
}
