import type { Peer, Ticket } from "./domain.ts";
import { RealtimeError } from "./domain.ts";
import type { RealtimeDependencies } from "./dependencies.ts";
import { createChannelState } from "./state.ts";
import type { ChannelState } from "./state.ts";
import { hasMessage } from "../i18n/messages.ts";
import { clientInput } from "./input.ts";
import { initializeChannel } from "./initialize.ts";
import { heartbeat } from "../operations/heartbeat.ts";
import { assertLive } from "./guard.ts";
import { UsageError } from "../accounting/domain.ts";

export class LiveChannel {
  private queue = Promise.resolve();
  private queuedBytes = 0;
  private queuedTasks = 0;
  private closing: Promise<void> | null = null;
  private stopHeartbeat: () => Promise<void>;
  private readonly timers: ReturnType<typeof setTimeout>[];
  readonly state: ChannelState;
  constructor(
    dependencies: RealtimeDependencies,
    ticket: Ticket,
    peer: Peer,
    authorized: () => Promise<boolean>,
  ) {
    const connection = dependencies.providers.effective("transcription");
    this.state = createChannelState(
      dependencies,
      ticket,
      peer,
      authorized,
      connection.provider === "deepgram" ? "deepgram" : "openai",
    );
    this.stopHeartbeat = heartbeat(
      async () => {
        await assertLive(this.state);
        return (
          (await authorized()) &&
          (!this.state.permit || (await this.state.permit.renew()))
        );
      },
      () => this.fail(new RealtimeError("realtime_closed")),
      dependencies.heartbeatMs ?? 10_000,
    );
    this.timers = [
      setTimeout(() => {
        if (!this.state.ready) this.fail(new RealtimeError("realtime_timeout"));
      }, 18_000),
      setTimeout(
        () => this.fail(new RealtimeError("realtime_limit")),
        3600_000,
      ),
      setInterval(() => this.enqueue(0, async () => this.state.notices()), 100),
      setInterval(() => {
        if (this.state.ready && this.state.config?.deepgram)
          this.enqueue(0, async () =>
            this.state.forward({ type: "KeepAlive" }),
          );
      }, 8000),
    ];
    this.timers.forEach((timer) => timer.unref());
    this.enqueue(0, () =>
      initializeChannel(
        this.state,
        connection,
        (size, work) => this.enqueue(size, work),
        () => this.fail(new RealtimeError("realtime_closed")),
      ),
    );
  }
  receive(value: unknown) {
    const size =
      value instanceof Uint8Array
        ? value.byteLength
        : (JSON.stringify(value)?.length ?? 0);
    this.enqueue(size, () => clientInput(this.state, value));
  }
  private enqueue(size: number, work: () => Promise<void>) {
    if (this.state.closed) return;
    if (this.queuedBytes + size > 512 * 1024 || this.queuedTasks >= 128) {
      this.fail(new RealtimeError("realtime_limit", 429));
      return;
    }
    this.queuedBytes += size;
    this.queuedTasks++;
    this.queue = this.queue
      .then(async () => {
        try {
          if (!this.state.closed) await work();
        } finally {
          this.queuedBytes -= size;
          this.queuedTasks--;
        }
      })
      .catch((error) => this.fail(error));
  }
  private fail(error: unknown) {
    if (this.state.closed) return;
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      hasMessage(error.code)
        ? error.code
        : "realtime_invalid";
    this.state.dependencies.log({ event: "realtime_failed", code,
      channelId: this.state.ticket.id,
      errorType: error instanceof Error ? error.name : typeof error });
    try {
      this.state.send({ type: "error", code, ...(error instanceof UsageError && error.details ? { details: error.details } : {}) });
    } catch {}
    void this.close();
  }
  close() {
    if (this.closing) return this.closing;
    this.state.closed = true;
    this.timers.forEach(clearTimeout);
    this.closing = Promise.resolve().then(async () => {
      await this.stopHeartbeat();
      await this.queue;
      this.state.drain.close();
      await this.state.permit?.release().catch(() =>
        this.state.dependencies.log({
          event: "realtime_release_pending",
          channelId: this.state.ticket.id,
        }),
      );
    });
    this.state.upstream?.close();
    this.state.peer.close(1000);
    return this.closing;
  }
}
