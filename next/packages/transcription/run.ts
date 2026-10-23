import { z } from "zod";
import type { RecordedAudio } from "./domain.ts";
import type { TranscriptionDependencies } from "./dependencies.ts";
import type { Operation } from "../operations/domain.ts";
import { executeOperation } from "../operations/execute.ts";
import { transcription } from "../providers/audio.ts";
import { ProviderError } from "../providers/domain.ts";
import { providerFailure } from "../providers/json.ts";
import { canonicalEndpoint } from "../providers/presets.ts";
import { LocalModelError } from "../local-models/domain.ts";
import { CapabilityError } from "../capabilities/domain.ts";
import { prepareInvocation, OperationPreparationError } from "../operations/preparation-error.ts";
import { legacyProviderReady } from "../providers/legacy-ready.ts";
import { normalizeTranscriptionText } from "./text.ts";

export function runTranscription(
  dependencies: TranscriptionDependencies,
  operation: Operation,
  input: RecordedAudio,
  signal: AbortSignal,
  authorized: () => Promise<boolean>,
) {
  return executeOperation(dependencies, operation, signal, authorized, {
    kind: "transcriptionSeconds",
    units: operation.snapshot?.metadata.durationSeconds ?? 1,
    async prepare(combined) {
      const snapshot = operation.snapshot;
      if (!snapshot) throw new ProviderError("provider_unavailable");
      if (snapshot.version === 1 && !legacyProviderReady(dependencies.providers, "transcription"))
        throw new ProviderError("provider_not_configured", 503);
      if (snapshot.version === 2) {
        if (!dependencies.capabilities) throw new ProviderError("provider_unavailable");
        await dependencies.capabilities.validate(snapshot.capabilities, ["transcription"]);
      }
      const connection = dependencies.providers.effective("transcription"),
        original = snapshot.provider;
      if (snapshot.version === 1 && (
        connection.provider !== original.provider ||
        canonicalEndpoint(connection.baseUrl) !==
          canonicalEndpoint(original.baseUrl)
      ))
        throw new ProviderError("original_provider_changed", 409);
      const context = z
        .object({
          language: z.union([
            z.literal("auto"),
            z.string().regex(/^[a-z]{2}$/),
          ]),
        })
        .strict()
        .parse(JSON.parse(snapshot.context));
      const provider = transcription(
        { ...connection, model: original.model },
        dependencies.transport,
      );
      return async () => {
        let text: string;
        const lease = snapshot.version === 2
          ? await prepareInvocation(() => dependencies.capabilities!.acquireTranscription(snapshot.capabilities, combined)) : null;
        if (snapshot.version === 2 && !lease) throw new ProviderError("provider_unavailable");
        try {
          text = normalizeTranscriptionText(
            await (lease?.provider ?? provider).transcribe(
              {
                data: input.data,
                name: input.name,
                mime: input.mime,
                language: context.language,
                prompt: snapshot.instructions,
              },
              combined,
            )
          );
        } catch (error) {
          if (combined.aborted)
            throw new DOMException("Interrupted", "AbortError");
          // Capacity rejection happens before a CLI starts and is safe to retry.
          if (error instanceof LocalModelError && ["runtime_busy", "runtime_not_loaded"].includes(error.code))
            throw new OperationPreparationError(error);
          if (error instanceof LocalModelError || error instanceof CapabilityError) throw error;
          throw providerFailure(error);
        } finally { await lease?.release(); }
        if (text.length > 16_000)
          throw new ProviderError("provider_unavailable");
        return {
          id: dependencies.identifier(),
          text,
          model: original.model,
          captureIds: [],
          ...(!text ? { empty: true } : {}),
        };
      };
    },
  });
}
