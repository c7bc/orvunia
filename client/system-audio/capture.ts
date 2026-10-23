import type { BoundaryOptions } from "../audio/contracts.js";
import { waitAudioBoundary } from "../audio/boundary.js";
import { nativeAudioMessage } from "./bridge.js";
import type { NativeAudioBridge } from "./bridge.js";

export type NativePcmCapture = { flush(options?: BoundaryOptions): Promise<void>; stop(): Promise<void> };
type Options = { sessionId: string; endpointId: string; identifier(): string; signal?: AbortSignal;
  frame(data: Uint8Array, rms: number, peak: number): void;
  ended(error?: Error): void };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("system_audio_protocol");
  return value as Record<string, unknown>;
}

export async function captureNativePcm(bridge: NativeAudioBridge, options: Options): Promise<NativePcmCapture> {
  options.signal?.throwIfAborted();
  const captureId = options.identifier();
  let sequence = 0, receivedFrames = 0, stopping = false, stopped = false, failure: Error | null = null;
  let stopPromise: Promise<void> | null = null;
  const waiters = new Set<{ frames: number; resolve(): void; reject(error: unknown): void }>();
  const watermark = (frames: unknown) => {
    if (!Number.isSafeInteger(frames) || Number(frames) < 0) return Promise.reject(Error("system_audio_protocol"));
    if (receivedFrames >= Number(frames)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => { waiters.add({ frames: Number(frames), resolve, reject }); });
  };
  function failed(error: unknown) {
    if (failure) return;
    failure = error instanceof Error ? error : Error("system_audio_failed");
    options.ended(failure);
    void stop().catch(() => {});
  }
  const unsubscribe = bridge.onEvent((value) => {
    try {
      const event = nativeAudioMessage(value, captureId);
      if (!event || stopped || failure) return;
      if (event.type === "error") { if (!stopping || event.code !== "system_audio_stopped") failed(Error(event.code)); return; }
      if (event.type === "ended") {
        if (!stopping) failed(Error("system_audio_ended"));
        return;
      }
      if (event.sequence !== sequence++) throw Error("system_audio_protocol");
      receivedFrames += event.data.byteLength / 2;
      options.frame(event.data, event.rms, event.peak);
      for (const waiter of waiters) if (receivedFrames >= waiter.frames) { waiters.delete(waiter); waiter.resolve(); }
      void bridge.systemAudio({ action: "ack", captureId, sequence: event.sequence }).catch(failed);
    } catch (error) { failed(error); }
  });
  async function stop() {
    if (stopPromise) return stopPromise;
    stopping = true;
    stopPromise = (async () => {
      try {
        const result = record(await bridge.systemAudio({ action: "stop", captureId }));
        await waitAudioBoundary(watermark(result.frames), { timeoutMs: 2000 });
      } finally {
        stopped = true; unsubscribe(); options.signal?.removeEventListener("abort", abort);
        for (const waiter of waiters) waiter.reject(failure ?? Error("system_audio_stopped"));
        waiters.clear();
      }
    })();
    return stopPromise;
  }
  function abort() { void stop().catch(() => {}); }
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const ready = record(await bridge.systemAudio({ action: "start", captureId, sessionId: options.sessionId,
      endpointId: options.endpointId, consent: true }));
    if (ready.captureId !== captureId || ready.sampleRate !== 24000 || ready.channels !== 1 || ready.format !== "pcm_s16le")
      throw Error("system_audio_protocol");
    if (failure) throw failure;
    options.signal?.throwIfAborted();
    return {
      stop,
      async flush(boundary = {}) {
        if (failure) throw failure;
        if (stopped) return;
        const id = options.identifier();
        await waitAudioBoundary((async () => {
          const result = record(await bridge.systemAudio({ action: "flush", captureId, id }));
          await watermark(result.frames);
        })(), boundary);
      },
    };
  } catch (error) { unsubscribe(); options.signal?.removeEventListener("abort", abort); await stop().catch(() => {}); throw error; }
}
