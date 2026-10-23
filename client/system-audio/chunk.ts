import type { BoundaryOptions, ChunkCallback, RecorderOptions, StateCallback } from "../audio/contracts.js";
import { waitAudioBoundary } from "../audio/boundary.js";
import type { NativeAudioBridge } from "./bridge.js";
import { captureNativePcm } from "./capture.js";
import type { NativePcmCapture } from "./capture.js";
import { nativePcmWave } from "./wave.js";

export class NativeChunkRecorder {
  running = false;
  starting = false;
  queued = 0;
  error: Error | null = null;
  private capture: NativePcmCapture | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private parts: Uint8Array[] = [];
  private bytes = 0;
  private queue: Promise<void> = Promise.resolve();
  private stopPromise: Promise<void> | null = null;
  private generation = 0;
  private controller: AbortController | undefined;
  private onChunk: ChunkCallback = () => {};
  private onState: StateCallback = () => {};
  constructor(private readonly bridge: NativeAudioBridge, private readonly identifier = () => crypto.randomUUID()) {}
  private submit() {
    if (!this.bytes) return;
    if (this.queued >= 8) throw Error("system_audio_backpressure");
    const blob = nativePcmWave(this.parts, this.bytes);
    this.parts = []; this.bytes = 0; this.queued++;
    this.queue = this.queue.then(async () => {
      if (this.error) throw this.error;
      this.onState("transcribing"); await this.onChunk(blob);
      if (this.running) this.onState("recording");
    }).catch((error: unknown) => {
      this.error = error instanceof Error ? error : Error("system_audio_failed");
      this.onState("error", this.error.message); void this.stop().catch(() => {});
    }).finally(() => { this.queued--; });
  }
  async start(source: string, onChunk: ChunkCallback, onState: StateCallback, options: RecorderOptions) {
    if (this.running || this.starting) return;
    if (source !== "display" || !options.sessionId) throw Error("system_audio_protocol");
    this.starting = true; this.error = null; this.stopPromise = null; this.onChunk = onChunk; this.onState = onState;
    const generation = ++this.generation;
    this.controller = new AbortController();
    const milliseconds = (options.seconds || 5) * 1000;
    try {
      this.capture = await captureNativePcm(this.bridge, {
        sessionId: options.sessionId, endpointId: options.device || "default:multimedia", identifier: this.identifier,
        signal: this.controller.signal,
        frame: (data, rms) => {
          if (this.error) return;
          this.parts.push(data.slice()); this.bytes += data.byteLength;
          onState("activity", { active: rms > 0.0002, at: Date.now() });
          if (this.bytes >= milliseconds * 48) this.submit();
        },
        ended: (error) => {
          if (error) { this.error = error; onState("error", error.message); }
          void this.stop().catch(() => {});
        },
      });
      if (generation !== this.generation) { await this.capture.stop(); throw new DOMException("Interrupted", "AbortError"); }
      this.running = true; onState("recording");
      this.timer = setInterval(() => {
        try { this.submit(); } catch (error) {
          this.error = error instanceof Error ? error : Error("system_audio_failed");
          onState("error", this.error.message); void this.stop().catch(() => {});
        }
      }, milliseconds);
    } finally { this.starting = false; }
  }
  async flush(options: BoundaryOptions = {}) {
    await waitAudioBoundary((async () => {
      if (this.error) throw this.error;
      await this.capture?.flush(options); this.submit(); await this.queue;
      if (this.error) throw this.error;
    })(), options);
  }
  stop() {
    if (this.stopPromise) return this.stopPromise;
    this.generation++;
    if (this.starting) this.controller?.abort();
    this.running = false; clearInterval(this.timer);
    this.stopPromise = (async () => {
      await this.capture?.stop(); this.submit(); await this.queue;
      this.onState("activity", { active: false, at: Date.now() });
      if (this.error) throw this.error;
    })();
    return this.stopPromise;
  }
}
