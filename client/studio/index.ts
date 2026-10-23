import { ChunkRecorder } from "../audio/recorder.js";
import { RealtimeAudio } from "../realtime/recorder.js";
import type { BoundaryOptions } from "../audio/contracts.js";
import type { FinalCallback } from "../realtime/contracts.js";
import type {
  AudioChannel,
  StudioCallbacks,
  StudioPlatform,
  StudioSettings,
} from "./contracts.js";
import { startChannel } from "./start.js";
import { pcmWave } from "./wave.js";
import { audioStops } from "./stopping.js";
import { nativeSystemAudioBridge } from "../system-audio/bridge.js";
import { NativeChunkRecorder } from "../system-audio/chunk.js";
export { createAudioTranscription } from "./transcription.js";
export { createListening } from "./listening.js";
export class StudioAudio {
  readonly channels = new Map<string, AudioChannel>();
  private readonly starts = new Map<string, Promise<void>>();
  private readonly stops = audioStops();
  readonly platform: StudioPlatform;
  constructor(platform?: StudioPlatform) {
    this.platform = platform ?? {
      chunk: (source) => {
        const native = source === "display" ? nativeSystemAudioBridge() : null;
        return native ? new NativeChunkRecorder(native) : new ChunkRecorder();
      },
      realtime: () => new RealtimeAudio(),
      wave: pcmWave,
    };
  }
  get running() {
    return [...this.channels.values()].some((channel) => channel.running);
  }
  start(
    kind: string,
    settings: StudioSettings,
    onChunk: StudioCallbacks["chunk"],
    onState: StudioCallbacks["state"],
    onTranscript: FinalCallback,
    onPartial?: StudioCallbacks["partial"],
  ) {
    const pending = this.starts.get(kind);
    if (pending) return pending;
    if (this.channels.get(kind)?.running) return Promise.resolve();
    let channel: AudioChannel | null = null;
    const callbacks: StudioCallbacks = {
      chunk: onChunk,
      state: onState,
      transcript: onTranscript,
      ...(onPartial ? { partial: onPartial } : {}),
    };
    const task = startChannel(
      kind,
      settings,
      callbacks,
      this.platform,
      (value) => {
        channel = value;
        this.channels.set(kind, value);
      },
    )
      .then(async () => {
        if (this.channels.get(kind) !== channel) {
          if (channel) await this.stops.stop(kind, channel);
          throw new DOMException("Interrupted", "AbortError");
        }
        this.stops.clear(kind);
      })
      .catch((error: unknown) => {
        if (this.channels.get(kind) === channel) this.channels.delete(kind);
        throw error;
      })
      .finally(() => {
        if (this.starts.get(kind) === task) this.starts.delete(kind);
      });
    this.starts.set(kind, task);
    return task;
  }
  async stop(kind?: string) {
    const entries = kind
      ? [[kind, this.channels.get(kind)] as const]
      : [...this.channels];
    for (const [key, channel] of entries) {
      if (!channel) continue;
      if (this.channels.get(key) === channel) this.channels.delete(key);
      void this.stops.stop(key, channel).catch(() => {});
    }
    const results = await Promise.allSettled(this.stops.pending(kind));
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
  async flush(options: BoundaryOptions = {}) {
    await Promise.all(
      [...this.channels.values()]
        .filter((channel) => channel.running || channel.queued || channel.error)
        .map((channel) => {
          if (typeof channel.flush !== "function")
            throw Error("A fonte de áudio não permite concluir a transcrição.");
          return channel.flush(options);
        }),
    );
  }
  async stopConfirmed() {
    const channels = [
        ...this.channels,
        ...this.stops.channels(),
        ...this.stops.failures(),
      ],
      starting = [...this.starts.values()];
    const retry = this.stops.failures().map(([kind, channel]) => this.stops.stop(kind, channel));
    const result = await Promise.allSettled([this.stop(), ...starting, ...retry]);
    const failed = [...channels, ...this.stops.failures()].filter(
      ([, channel]) => this.stops.error(channel),
    );
    if (failed.length || result[0]?.status === "rejected")
      throw Error(
        "Uma fala ficou sem confirmação final. Confira a transcrição.",
      );
  }
}
