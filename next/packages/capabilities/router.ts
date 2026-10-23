import { randomUUID } from "node:crypto";
import type { ConnectionService } from "../connections/service.ts";
import type { LocalModelComposition } from "../local-models/compose.ts";
import { validatePcmWave } from "../local-models/wave.ts";
import type { GenerationProvider, TranscriptionAdapter } from "../providers/domain.ts";
import type { HttpFetch } from "../providers/http.ts";
import { generation } from "../providers/generation.ts";
import { transcription } from "../providers/audio.ts";
import { responseConnection, transcriptionConnection } from "./api.ts";
import { CapabilityError, type CapabilityPlan, type CapabilityTarget } from "./domain.ts";
import { LocalCapabilityLeases } from "./leases.ts";
import { resolveCapabilityPlan } from "./plan.ts";
import { validateCapabilities } from "./validation.ts";
import type { Capability } from "./domain.ts";

export type AudioNormalizer = (audio: Uint8Array, mime: string, signal: AbortSignal) => Promise<Uint8Array>;
export type CapabilityLease<Provider> = { provider: Provider; release(): Promise<void> };
export function capabilityRouter(dependencies: {
  connections: ConnectionService;
  models: LocalModelComposition["service"];
  transport: HttpFetch;
  audio?: AudioNormalizer;
}) {
  const leases = new LocalCapabilityLeases(dependencies.models);
  async function acquireGeneration(target: CapabilityTarget, vision: boolean, signal: AbortSignal): Promise<CapabilityLease<GenerationProvider>> {
    if (target.kind === "disabled") throw new CapabilityError(vision ? "vision_disabled" : "text_disabled", 422);
    if (target.kind === "api") {
      const connection = await responseConnection(target, dependencies.connections, vision);
      return { provider: generation(connection, dependencies.transport), release: async () => {} };
    }
    const release = await leases.acquire(target, signal);
    return { release, provider: {
      async answer(input, operationSignal, delta) {
        const text = await dependencies.models.lifecycle.generate(target.installationId, randomUUID(), {
          instructions: input.instructions, prompt: input.context,
          images: input.images.map((image) => {
            if (image.mime !== "image/png" && image.mime !== "image/jpeg") throw new CapabilityError("local_image_format_unsupported", 422);
            return { mime: image.mime, data: image.data };
          }),
        }, operationSignal);
        delta(text);
        return { text, model: `local:${target.catalogId}@${target.catalogRevision}` };
      },
    } };
  }
  return {
    validate(plan: CapabilityPlan, required: readonly Capability[]) {
      return validateCapabilities(plan, required, dependencies.connections, dependencies.models);
    },
    async resolvePlan(expectedRevision?: number): Promise<CapabilityPlan> {
      const configuration = await dependencies.connections.configuration();
      if (expectedRevision !== undefined && configuration.revision !== expectedRevision)
        throw new CapabilityError("connection_revision_conflict");
      return resolveCapabilityPlan(configuration, dependencies.models);
    },
    acquireText(plan: CapabilityPlan, signal = new AbortController().signal) {
      return acquireGeneration(plan.text, plan.vision.kind === "shared", signal);
    },
    acquireVision(plan: CapabilityPlan, signal = new AbortController().signal) {
      return acquireGeneration(plan.vision.kind === "shared" ? plan.text : plan.vision, true, signal);
    },
    async acquireTranscription(plan: CapabilityPlan, signal = new AbortController().signal): Promise<CapabilityLease<TranscriptionAdapter>> {
      const target = plan.transcription;
      if (target.kind === "disabled") throw new CapabilityError("transcription_disabled", 422);
      if (target.kind === "api") {
        const connection = await transcriptionConnection(target, dependencies.connections);
        return { provider: transcription(connection, dependencies.transport), release: async () => {} };
      }
      const release = await leases.acquire(target, signal);
      return { release, provider: {
        async transcribe(input, operationSignal) {
          const audio = dependencies.audio ? await dependencies.audio(input.data, input.mime, operationSignal) : input.data;
          validatePcmWave(audio);
          return dependencies.models.lifecycle.transcribe(target.installationId, randomUUID(), audio,
            input.language === "pt-BR" ? "pt" : input.language, operationSignal);
        },
      } };
    },
  };
}
export type CapabilityRouter = ReturnType<typeof capabilityRouter>;
