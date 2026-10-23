import type {
  FinalCallback,
  RealtimeOptions,
  RealtimePlatform,
  RealtimeStateCallback,
  Waiter,
} from "./contracts";
import type { BoundaryOptions } from "../audio/contracts";
import { browserRealtime } from "./browser";
import { connect } from "./connection";
import { capture } from "./capture";
import { flushBoundary, waitPacket } from "./boundary";
import { stopAudio } from "./stop";
import type { WorkletSignal } from "./protocol";
import type { NativePcmCapture } from "../system-audio/capture.js";
import { AudioConfirmation } from "./confirmation.js";

export class RealtimeAudio {
  running = false;
  starting = false;
  pending = 0;
  stopping = false;
  supportsFlush = false;
  waiters = new Map<string, Waiter>();
  error: Error | null = null;
  deliveries: Promise<void> = Promise.resolve();
  stopPromise: Promise<void> | null = null;
  flushPromise: Promise<void> | null = null;
  ws: WebSocket | undefined;
  stream: MediaStream | undefined;
  context: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  processor: AudioWorkletNode | undefined;
  onState?: RealtimeStateCallback;
  options?: RealtimeOptions;
  activityAt: number | undefined;
  private activityValue: boolean | undefined;
  ping: ReturnType<typeof setInterval> | undefined;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  pendingSince: number | undefined;
  private pendingCommits: { at: number; received: boolean }[] = [];
  flushed: (() => void) | undefined;
  signal: WorkletSignal | null = null;
  nativeCapture: NativePcmCapture | undefined;
  nativeAbort: AbortController | undefined;
  confirmation = new AudioConfirmation();
  get shutdownError() { return this.confirmation.error ?? (this.pending > 0
    ? Error("Uma fala ficou sem confirmação final. Confira a transcrição.") : null); }
  constructor(readonly platform: RealtimePlatform = browserRealtime()) {}
  private async releaseNative() { await this.nativeCapture?.stop().catch(() => {}); }
  async start(
    source: string,
    onFinal: FinalCallback,
    onState: RealtimeStateCallback,
    options: RealtimeOptions,
  ) {
    if (this.running || this.starting) return;
    this.starting = true;
    this.onState = onState;
    this.options = options;
    this.error = null;
    this.confirmation = new AudioConfirmation();
    this.stopPromise = null;
    this.stopping = false;
    this.supportsFlush = false;
    this.signal = null;
    this.activityAt = undefined;
    this.activityValue = undefined;
    this.nativeCapture = undefined;
    this.nativeAbort = undefined;
    try {
      const socket = await connect(this, source, onFinal, onState, options);
      await capture(this, source, socket, onState, options);
      this.watchdog = setInterval(() => {
        const error = this.pendingError();
        if (!error || this.stopping) return;
        this.error = error; this.confirmation.failure = error;
        this.rejectFlushes(error); this.onState?.("error", error.message); void this.stop();
      }, 250);
    } catch (error) {
      this.stream?.getTracks().forEach((track) => track.stop());
      await this.releaseNative();
      await this.context?.close().catch(() => {});
      this.ws?.close();
      throw error;
    } finally {
      this.starting = false;
    }
  }
  rejectFlushes(error: unknown) {
    for (const waiter of [...this.waiters.values()]) waiter.reject(error);
  }
  markCommit() {
    if (this.pendingCommits.length >= 256) throw Error("Audio confirmation backlog exceeded");
    this.pendingCommits.push({ at: this.platform.clock(), received: false });
    this.pendingSince ??= this.platform.clock();
    this.confirmation.commit(); this.pending++;
  }
  finalDelivery() {
    const commit = this.pendingCommits.find(item => !item.received);
    if (commit) commit.received = true;
    return () => {
      if (!commit) return;
      const index = this.pendingCommits.indexOf(commit);
      if (index >= 0) this.pendingCommits.splice(index, 1);
      this.pendingSince = this.pendingCommits[0]?.at;
    };
  }
  pendingError() {
    return this.pendingSince !== undefined && (this.pending > 0 || this.confirmation.deliveriesPending > 0)
      && this.platform.clock() - this.pendingSince >= 20_000
      ? Error("Uma fala ficou sem confirmação final. Confira a transcrição.") : null;
  }
  waitPacket(key: string, send: () => void, options: BoundaryOptions = {}) {
    return waitPacket(this, key, send, options);
  }
  flush(options: BoundaryOptions = {}) {
    if (!this.flushPromise)
      this.flushPromise = this.flushBoundary(options).finally(() => {
        this.flushPromise = null;
      });
    return this.flushPromise;
  }
  flushBoundary(options: BoundaryOptions = {}) {
    return flushBoundary(this, options);
  }
  activity(active: unknown, observedAt = this.platform.clock()) {
    if (!this.running || this.stopping) return;
    const at = this.platform.clock();
    const next = active === true;
    if (next === this.activityValue && (!next || (this.activityAt !== undefined && at - this.activityAt < 90))) return;
    this.activityAt = at;
    this.activityValue = next;
    this.onState?.("activity", { active: next, at: Math.min(at, observedAt) });
  }
  async stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true;
    if (this.starting) this.nativeAbort?.abort();
    this.running = false;
    this.onState?.("activity", { active: false, at: this.platform.clock() });
    clearInterval(this.ping);
    clearInterval(this.watchdog);
    this.stopPromise = stopAudio(this);
    return this.stopPromise;
  }
}
