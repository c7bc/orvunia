import type {
  AudioPlatform,
  BoundaryOptions,
  ChunkCallback,
  RecorderOptions,
  StateCallback,
} from "./contracts";
import { browserAudio } from "./browser";
import { startAudio } from "./start";
import { recordChunk } from "./chunk";
import { waitAudioBoundary } from "./boundary";

export class ChunkRecorder {
  running = false;
  starting = false;
  generation = 0;
  queue: Promise<void> = Promise.resolve();
  queued = 0;
  stopPromise: Promise<void> | null = null;
  error: Error | null = null;
  flushPromise: Promise<void> | null = null;
  currentStopped: Promise<void> = Promise.resolve();
  chunkMilliseconds = 6000;
  speech = false;
  onChunk?: ChunkCallback;
  onState?: StateCallback;
  stream: MediaStream | undefined;
  audioStream: MediaStream | undefined;
  mime: string | undefined;
  audioContext: AudioContext | undefined;
  analyser: AnalyserNode | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recorder: MediaRecorder | undefined;
  chunkTimer: ReturnType<typeof setTimeout> | undefined;
  levelTimer: ReturnType<typeof setInterval> | undefined;
  activeVoice: boolean | undefined;
  activityAt = 0;
  constructor(readonly platform: AudioPlatform = browserAudio()) {}
  start(
    source: string,
    onChunk: ChunkCallback,
    onState: StateCallback,
    options: RecorderOptions = {},
  ) {
    return startAudio(this, source, onChunk, onState, options);
  }
  recordChunk() {
    recordChunk(this);
  }
  release() {
    this.activity(false, true);
    clearTimeout(this.chunkTimer);
    clearInterval(this.levelTimer);
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.audioContext && this.audioContext.state !== "closed")
      void this.audioContext.close().catch(() => {});
  }
  activity(active: boolean, force = false) {
    const at = this.platform.clock();
    if (!force && this.activeVoice === active && at - this.activityAt < 100)
      return;
    this.activeVoice = active;
    this.activityAt = at;
    this.onState?.("activity", { active, at });
  }
  flush(options: BoundaryOptions = {}) {
    if (options.signal?.aborted)
      return Promise.reject(new DOMException("Interrupted", "AbortError"));
    if (!this.flushPromise)
      this.flushPromise = (async () => {
        if (this.error) throw this.error;
        const stopped = this.currentStopped;
        clearTimeout(this.chunkTimer);
        if (this.recorder?.state === "recording") this.recorder.stop();
        await stopped;
        const submitted = this.queue;
        await submitted;
        if (this.error) throw this.error;
      })().finally(() => {
        this.flushPromise = null;
      });
    return waitAudioBoundary(this.flushPromise, options);
  }
  stop() {
    if (this.stopPromise) return this.stopPromise;
    this.generation++;
    this.stopPromise = (async () => {
      this.running = false;
      clearTimeout(this.chunkTimer);
      if (this.recorder?.state === "recording") this.recorder.stop();
      await this.currentStopped;
      this.release();
      await this.queue;
    })();
    return this.stopPromise;
  }
}
