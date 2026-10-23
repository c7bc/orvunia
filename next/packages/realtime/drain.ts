export type FlushNotice =
  | { type: "flushed"; id: string }
  | {
      type: "flush-error";
      id: string;
      code: "realtime_pending" | "realtime_timeout";
    };
type Turn = { end: number; item: string | null; complete: boolean };
type Waiter = { id: string; target: number; deadline: number };
export const realtimeFlushTimeout = 8000;
const limit = 256;

/** Byte watermarks, never a decrement-per-final counter. PCM is mono PCM16/24kHz. */
export class RealtimeDrain {
  private received = 0;
  private committedBytes = 0;
  private settled = 0;
  private turns: Turn[] = [];
  private items = new Map<string, Turn>();
  private recentItems = new Set<string>();
  private ranges: [number, number][] = [];
  private waiters = new Map<string, Waiter>();
  private outcomes = new Map<string, FlushNotice>();
  constructor(
    readonly provider: "openai" | "deepgram",
    readonly now: () => number = Date.now,
    readonly timeoutMs = realtimeFlushTimeout,
  ) {}
  get bytes() {
    return this.received;
  }
  get uncommittedBytes() {
    return this.received - this.committedBytes;
  }
  get confirmedBytes() {
    return this.settled;
  }
  append(bytes: number) {
    if (
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      bytes % 2 ||
      this.received + bytes > 48000 * 3600
    )
      throw Error("Invalid PCM watermark");
    this.received += bytes;
  }
  commit() {
    const bytes = this.uncommittedBytes;
    if (!bytes) return 0;
    if (this.provider === "openai") {
      if (this.turns.length >= limit)
        throw Error("Too many pending transcription turns");
      this.turns.push({ end: this.received, item: null, complete: false });
    }
    this.committedBytes = this.received;
    return bytes;
  }
  committed(item: string) {
    if (!item || item.length > 200) throw Error("Invalid provider item ID");
    if (this.items.has(item) || this.recentItems.has(item)) return false;
    const turn = this.turns.find((turn) => turn.item === null);
    if (!turn) throw Error("Provider acknowledged an unknown commit");
    turn.item = item;
    this.items.set(item, turn);
    return true;
  }
  hasCommitted(item: string) {
    return this.items.has(item) || this.recentItems.has(item);
  }
  nextItem() {
    return this.turns[0]?.item ?? null;
  }
  completed(item: string) {
    const turn = this.items.get(item);
    if (!turn) return false;
    turn.complete = true;
    while (this.turns[0]?.complete) {
      const next = this.turns.shift()!;
      this.settled = next.end;
      this.items.delete(next.item!);
      this.recentItems.add(next.item!);
      if (this.recentItems.size > 4096)
        this.recentItems.delete(this.recentItems.values().next().value!);
    }
    return true;
  }
  deepgramFinal(start: number, duration: number) {
    if (
      this.provider !== "deepgram" ||
      !Number.isFinite(start) ||
      !Number.isFinite(duration) ||
      start < 0 ||
      duration < 0 ||
      start + duration > 3601
    )
      return false;
    const from = Math.ceil(start * 48000 - 1e-6),
      to = Math.floor((start + duration) * 48000 + 1e-6);
    if (to <= from || to > this.received) return false;
    this.ranges.push([from, to]);
    this.ranges.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const range of this.ranges) {
      const prior = merged.at(-1);
      if (prior && range[0] <= prior[1])
        prior[1] = Math.max(prior[1], range[1]);
      else merged.push([...range]);
    }
    if (merged.length > limit)
      throw Error("Too many disjoint final audio ranges");
    this.ranges = merged;
    if (merged[0]?.[0] === 0) this.settled = merged[0][1];
    return true;
  }
  flush(id: string): FlushNotice[] {
    const old = this.outcomes.get(id);
    if (old) return [old];
    if (this.waiters.has(id)) return this.poll();
    if (this.waiters.size >= 8)
      return [
        {
          type: "flush-error",
          id,
          code: "realtime_pending",
        },
      ];
    this.waiters.set(id, {
      id,
      target: this.received,
      deadline: this.now() + this.timeoutMs,
    });
    return this.poll();
  }
  poll(): FlushNotice[] {
    const notices: FlushNotice[] = [];
    for (const [id, waiter] of this.waiters) {
      const notice: FlushNotice | undefined =
        this.settled >= waiter.target
          ? { type: "flushed", id }
          : this.now() >= waiter.deadline
            ? {
                type: "flush-error",
                id,
                code: "realtime_timeout",
              }
            : undefined;
      if (!notice) continue;
      this.waiters.delete(id);
      this.outcomes.set(id, notice);
      notices.push(notice);
      if (this.outcomes.size > 64)
        this.outcomes.delete(this.outcomes.keys().next().value!);
    }
    return notices;
  }
  close() {
    this.waiters.clear();
    this.outcomes.clear();
    this.turns = [];
    this.items.clear();
    this.recentItems.clear();
    this.ranges = [];
  }
}
