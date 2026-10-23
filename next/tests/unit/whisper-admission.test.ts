import { expect, test } from "bun:test";
import { WhisperAdmission } from "../../packages/local-models/whisper-admission.ts";

test("synchronous admission caps five callers at two operations and rejects duplicate IDs", async () => {
  const admission = new WhisperAdmission(), signal = new AbortController().signal;
  const first = admission.acquire("first", signal), second = admission.acquire("second", signal);
  for (const id of ["third", "fourth", "fifth", "first", "second"])
    expect(() => admission.acquire(id, signal)).toThrow("runtime_busy");
  await first.ready;
  let secondReady = false; void second.ready.then(() => { secondReady = true; });
  await Promise.resolve(); expect(secondReady).toBe(false);
  first.release(); await second.ready; expect(secondReady).toBe(true);
  second.release(); second.release();
  const next = admission.acquire("first", signal); await next.ready; next.release();
});

test("cancelled queued operation frees capacity but cannot start its replacement before the active operation drains", async () => {
  const admission = new WhisperAdmission(), signal = new AbortController().signal;
  const active = admission.acquire("active", signal), queued = admission.acquire("queued", signal);
  const rejected = queued.ready.catch((error: unknown) => error);
  admission.cancel("queued"); expect(await rejected).toMatchObject({ name: "AbortError" }); queued.release();
  const replacement = admission.acquire("replacement", signal);
  let started = false; void replacement.ready.then(() => { started = true; });
  await Promise.resolve(); expect(started).toBe(false);
  active.release(); await replacement.ready; expect(started).toBe(true); replacement.release();
});

test("external queued cancellation and active cancellation retain ordering until explicit resource cleanup", async () => {
  const admission = new WhisperAdmission(), signal = new AbortController().signal;
  const active = admission.acquire("active", signal), controller = new AbortController();
  const queued = admission.acquire("queued", controller.signal);
  const rejected = queued.ready.catch((error: unknown) => error);
  controller.abort(); expect(await rejected).toMatchObject({ name: "AbortError" }); queued.release();
  admission.cancel("active"); expect(active.signal.aborted).toBe(true);
  const next = admission.acquire("next", signal); let ready = false;
  void next.ready.then(() => { ready = true; });
  await Promise.resolve(); expect(ready).toBe(false);
  active.release(); await next.ready; expect(ready).toBe(true); next.release();
});
