import { LocalModelError } from "./domain.ts";

type Entry = {
  id: string; controller: AbortController; signal: AbortSignal;
  ready: Promise<void>; resolve(): void; reject(reason: unknown): void; abort(): void;
};

export class WhisperAdmission {
  private readonly entries = new Map<string, Entry>();
  private readonly waiting: Entry[] = [];
  private active: Entry | null = null;

  acquire(id: string, signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.entries.size >= 2 || this.entries.has(id)) throw new LocalModelError("runtime_busy", 409);
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal, AbortSignal.timeout(120_000)]);
    let resolve: () => void = () => {}, reject: (reason: unknown) => void = () => {};
    const ready = new Promise<void>((accept, decline) => { resolve = accept; reject = decline; });
    const entry: Entry = { id, controller, signal: combined, ready, resolve, reject,
      abort: () => { if (this.active !== entry) reject(combined.reason); } };
    this.entries.set(id, entry);
    this.waiting.push(entry);
    combined.addEventListener("abort", entry.abort, { once: true });
    this.advance();
    let released = false;
    return { signal: combined, ready, release: () => {
      if (released) return;
      released = true;
      combined.removeEventListener("abort", entry.abort);
      this.entries.delete(id);
      const index = this.waiting.indexOf(entry);
      if (index >= 0) this.waiting.splice(index, 1);
      if (this.active === entry) this.active = null;
      this.advance();
    } };
  }

  private advance() {
    if (this.active) return;
    const next = this.waiting.shift();
    if (!next) return;
    this.active = next;
    if (next.signal.aborted) next.reject(next.signal.reason);
    else next.resolve();
  }

  cancel(id: string) { this.entries.get(id)?.controller.abort(); }
}
