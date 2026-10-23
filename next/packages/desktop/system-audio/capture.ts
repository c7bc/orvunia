import { helperEvent } from "./contracts.ts";
import type { CaptureMetadata, CaptureOwner, HelperProcess, SystemAudioPorts } from "./ports.ts";
import { SystemAudioError } from "./ports.ts";
import { createPcmFlow } from "./flow.ts";

export function createSystemAudioCapture(ports: SystemAudioPorts, owner: CaptureOwner,
  captureId: string, endpointId: string, exited: () => void) {
  let process: HelperProcess | null = null, ready = false, stopping = false, ended = false;
  let error: Error | null = null, frames: number | undefined, stopPromise: Promise<void> | null = null;
  const buffered: Uint8Array[] = [];
  let bufferedBytes = 0;
  const flushes = new Map<string, { promise: Promise<{ frames: number }>; resolve(value: { frames: number }): void;
    reject(error: unknown): void; timer: ReturnType<typeof setTimeout> }>();
  const completed = new Map<string, number>();
  let resolveReady!: (value: CaptureMetadata) => void, rejectReady!: (error: unknown) => void;
  const started = new Promise<CaptureMetadata>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  void started.catch(() => {});
  const flow = createPcmFlow(captureId, (value) => {
    if (!ports.allowed(owner)) throw new SystemAudioError("system_audio_owner_changed");
    ports.event(owner, value);
  });
  const startup = setTimeout(() => fail(new SystemAudioError("system_audio_timeout")), 15000);
  startup.unref();
  function fail(value: Error) {
    if (!error) { error = value; ports.event(owner, { type: "error", captureId,
      code: value instanceof SystemAudioError ? value.code : "system_audio_failed" }); }
    rejectReady(value);
    for (const pending of flushes.values()) { clearTimeout(pending.timer); pending.reject(value); }
    flushes.clear();
    void stop().catch(() => {});
  }
  function receive(value: Uint8Array) {
    try {
      if (ended || error) return;
      if (!ports.allowed(owner)) throw new SystemAudioError("system_audio_owner_changed");
      if (!ready) {
        bufferedBytes += value.byteLength;
        if (bufferedBytes > 48000) throw new SystemAudioError("system_audio_protocol");
        buffered.push(value.slice());
      } else flow.feed(value);
    } catch (failure) { fail(failure instanceof Error ? failure : new SystemAudioError("system_audio_failed")); }
  }
  function metadata(value: unknown) {
    try {
      const message = helperEvent.parse(value);
      if (message.event === "error") { fail(new SystemAudioError("system_audio_" + message.code)); return; }
      if (message.event === "ready") {
        if (ready || stopping) throw new SystemAudioError("system_audio_protocol");
        if (!endpointId.startsWith("default:") && message.endpointId !== endpointId)
          throw new SystemAudioError("system_audio_endpoint_mismatch");
        ready = true; clearTimeout(startup); resolveReady(message);
        for (const chunk of buffered.splice(0)) flow.feed(chunk);
        bufferedBytes = 0;
      } else if (message.event === "flushed") {
        const pending = flushes.get(message.id);
        if (!pending) return;
        void flow.watermark(message.frames).then(() => {
          if (!flushes.delete(message.id)) return;
          clearTimeout(pending.timer); completed.set(message.id, message.frames);
          if (completed.size > 32) completed.delete(completed.keys().next().value!);
          pending.resolve({ frames: message.frames });
        }, pending.reject);
      } else frames = message.frames;
    } catch (failure) { fail(failure instanceof SystemAudioError ? failure : new SystemAudioError("system_audio_protocol")); }
  }
  function closed(code: number | null) {
    ended = true; clearTimeout(startup);
    if (code !== 0) error ??= new SystemAudioError("system_audio_helper_failed");
    if (ready && frames === undefined) error ??= new SystemAudioError("system_audio_incomplete");
    if (!ready) rejectReady(error ?? new SystemAudioError("system_audio_start_failed"));
    try { flow.finish(frames); } catch (failure) { error ??= failure as Error; }
    for (const pending of flushes.values()) { clearTimeout(pending.timer); pending.reject(error ?? new SystemAudioError("system_audio_stopped")); }
    flushes.clear(); buffered.length = 0;
    if (!stopping || code !== 0 || error) ports.event(owner, { type: "error", captureId,
      code: error instanceof SystemAudioError ? error.code : "system_audio_ended" });
    ports.event(owner, { type: "ended", captureId }); exited();
  }
  async function stop() {
    if (stopPromise) return stopPromise;
    stopping = true; clearTimeout(startup);
    rejectReady(new SystemAudioError("system_audio_stopped"));
    stopPromise = (async () => {
      const child = process;
      if (!child || ended) return;
      child.command({ command: "stop" }); child.endInput();
      const force = setTimeout(() => child.terminate(), 3000); force.unref();
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([child.closed, new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => reject(new SystemAudioError("system_audio_stop_unconfirmed")), 5000);
        })]);
      } finally { clearTimeout(force); clearTimeout(deadline); }
      if (error) throw error;
    })();
    return stopPromise;
  }
  return {
    captureId, owner,
    frames: () => flow.bytes() / 2,
    async start() {
      try {
        process = ports.launch("capture", { data: receive, metadata, exited: closed });
        if (!process.command({ command: "start", endpointId })) throw new SystemAudioError("system_audio_start_failed");
        return await started;
      } catch (failure) {
        fail(failure instanceof Error ? failure : new SystemAudioError("system_audio_failed"));
        if (!process && !ended) closed(null);
        await stop().catch(() => {}); throw failure;
      }
    },
    stop,
    acknowledge: flow.acknowledge,
    flush(id: string) {
      if (!ready || stopping || error || !ports.allowed(owner)) return Promise.reject(error ?? new SystemAudioError("system_audio_stopped"));
      if (completed.has(id)) return Promise.resolve({ frames: completed.get(id)! });
      const existing = flushes.get(id); if (existing) return existing.promise;
      if (flushes.size >= 8) return Promise.reject(new SystemAudioError("system_audio_busy"));
      let resolve!: (value: { frames: number }) => void, reject!: (error: unknown) => void;
      const promise = new Promise<{ frames: number }>((done, fail) => { resolve = done; reject = fail; });
      const timer = setTimeout(() => { flushes.delete(id); reject(new SystemAudioError("system_audio_flush_timeout")); }, 8000);
      flushes.set(id, { promise, resolve, reject, timer });
      if (!process?.command({ command: "flush", id })) { clearTimeout(timer); flushes.delete(id); reject(new SystemAudioError("system_audio_stopped")); }
      return promise;
    },
  };
}
