import { expect, test } from "bun:test";
import { RealtimeAudio } from "../../../client/realtime/recorder.ts";
import { connect } from "../../../client/realtime/connection.ts";
import type { RealtimePlatform } from "../../../client/realtime/contracts.ts";
import { StudioAudio } from "../../../client/studio/index.ts";
import { audioStops } from "../../../client/studio/stopping.ts";

function pending() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function environment() {
  let opened = true;
  const socket = { bufferedAmount: 0, onmessage: null as null | ((event: { data: string }) => void),
    onclose: null as null | (() => void), send(_value: unknown) {}, close() { opened = false; } };
  const forbidden = () => { throw Error("No acquisition allowed"); };
  const platform: RealtimePlatform = { request: async () => Response.json({ ticket: "controlled" }),
    socket: () => { queueMicrotask(() => message({ type: "ready", supportsFlush: true })); return socket as unknown as WebSocket; },
    acquire: forbidden, context: forbidden, stream: forbidden, processor: forbidden,
    open: () => opened, clock: () => Date.now(), identifier: () => crypto.randomUUID() };
  const state = new RealtimeAudio(platform);
  function message(value: unknown) { socket.onmessage?.({ data: JSON.stringify(value) }); }
  return { state, socket, platform, message, disconnect() { opened = false; socket.onclose?.(); } };
}
const options = { sessionId: crypto.randomUUID(), time: () => "00:01" };
const transcript = { id: "controlled", text: "Synthetic words", who: "Interviewer", source: "realtime", time: "00:01" };

test("final confirmation waits for history persistence; later transport failure cannot poison a confirmed stop", async () => {
  const test = environment(), saved = pending(), queued: unknown[] = [];
  await connect(test.state, "display", () => saved.promise, (type, value) => { if (type === "queued") queued.push(value); }, options);
  test.state.running = true;
  test.state.confirmation.append(960); test.state.markCommit();
  test.message({ type: "final", itemId: "item", transcript });
  expect(test.state.shutdownError).toBeInstanceOf(Error);
  expect(queued).not.toContain(0);
  expect(test.state.pendingSince).toBeDefined();
  saved.resolve(); await test.state.deliveries;
  expect(test.state.shutdownError).toBeNull();
  expect(queued).toEqual([0]);
  expect(test.state.pendingSince).toBeUndefined();
  test.disconnect(); await test.state.stop();
  test.state.error = Error("realtime_limit");
  expect(test.state.error.message).toBe("realtime_limit");
  expect(test.state.shutdownError).toBeNull();
});

test("a failed history write remains an exit barrier even when all PCM received finals", async () => {
  const test = environment();
  await connect(test.state, "display", async () => { throw Error("Storage unavailable"); }, () => {}, options);
  test.state.confirmation.append(960); test.state.confirmation.commit(); test.state.pending = 1;
  test.message({ type: "final", itemId: "item", transcript });
  await test.state.deliveries;
  expect(test.state.shutdownError?.message).toBe("Storage unavailable");
});

test("empty finals confirm processed silence but cannot confirm a later uncommitted audio tail", async () => {
  const test = environment();
  await connect(test.state, "display", () => {}, () => {}, options);
  test.state.confirmation.append(960); test.state.confirmation.commit(); test.state.pending = 1;
  test.state.confirmation.append(48);
  test.message({ type: "final", itemId: "silent" });
  await test.state.deliveries;
  expect(test.state.confirmation.confirmed).toBe(960);
  expect(test.state.shutdownError).toBeInstanceOf(Error);
});

test("an empty final never bypasses a previous transcript still waiting for persistence", async () => {
  const test = environment(), saved = pending();
  await connect(test.state, "display", () => saved.promise, () => {}, options);
  test.state.confirmation.append(960); test.state.confirmation.commit(); test.state.pending = 2;
  test.message({ type: "final", itemId: "speech", transcript });
  test.message({ type: "final", itemId: "silence" });
  await Bun.sleep(1);
  expect(test.state.shutdownError).toBeInstanceOf(Error);
  saved.resolve(); await test.state.deliveries;
  expect(test.state.shutdownError).toBeNull();
});

test("no PCM permission or quota failures permit shutdown while retaining their visible error", async () => {
  const test = environment();
  test.state.error = Error("Permission denied");
  await test.state.stop();
  expect(test.state.error.message).toBe("Permission denied");
  expect(test.state.shutdownError).toBeNull();
});

test("outstanding final acknowledgements block even when a source emitted no samples", async () => {
  const test = environment(); test.state.pending = 1;
  expect(test.state.shutdownError).toBeInstanceOf(Error);
  test.state.pending = 0;
  expect(test.state.shutdownError).toBeNull();
});

test("a late matching flush receipt reconciles its original watermark without replaying inference", async () => {
  const test = environment();
  await connect(test.state, "display", () => {}, () => {}, options);
  test.state.confirmation.append(960); test.state.confirmation.flushing("known-flush");
  test.state.error = Error("Timed out waiting for confirmation");
  test.message({ type: "flushed", id: "unrelated" });
  await test.state.deliveries;
  expect(test.state.shutdownError).toBeInstanceOf(Error);
  test.message({ type: "flushed", id: "known-flush" });
  await test.state.deliveries;
  expect(test.state.shutdownError).toBeNull();
  expect(test.state.error?.message).toBe("Timed out waiting for confirmation");
});

test("confirmed retry clears the previous stop barrier without erasing the operational error", async () => {
  let debt = Error("Tail pending") as Error | null, retries = 0;
  const channel = { running: false, error: Error("Transport failed"),
    get shutdownError() { return debt; },
    async start() { this.running = true; },
    async stop() { this.running = false; if (++retries === 1) throw debt; debt = null; },
    async flush() {},
  };
  const audio = new StudioAudio({ chunk: () => channel, realtime: () => channel, wave: async (blob) => blob });
  await audio.start("system", { ...options, realtime: false }, () => {}, () => {}, () => {});
  await expect(audio.stopConfirmed()).rejects.toThrow("Uma fala ficou sem confirmação");
  expect(channel.error).toBeInstanceOf(Error);
  await audio.stopConfirmed();
  expect(retries).toBe(2);
  expect(channel.error).toBeInstanceOf(Error);
});

test("a successful stop with an unconfirmed tail still blocks every exit attempt", async () => {
  const test = environment(); test.state.confirmation.append(960);
  const audio = new StudioAudio({ chunk: () => { throw Error("No chunk"); }, realtime: () => test.state,
    wave: async (blob) => blob });
  audio.channels.set("system", test.state);
  await expect(audio.stopConfirmed()).rejects.toThrow("Uma fala ficou sem confirmação");
  await expect(audio.stopConfirmed()).rejects.toThrow("Uma fala ficou sem confirmação");
  expect(test.state.confirmation.sent).toBe(960);
  expect(test.state.confirmation.confirmed).toBe(0);
});

test("a newer source cannot replace or clear an older instance with unconfirmed audio", async () => {
  const stops = audioStops();
  const older = { running: false, error: Error("Older unsaved tail") as Error | null, stop: async () => {}, flush: async () => {} };
  const newer = { running: false, error: Error("Newer unsaved tail"), stop: async () => {}, flush: async () => {} };
  await stops.stop("system", older); await stops.stop("system", newer);
  stops.clear("system");
  expect(stops.failures().map(([, channel]) => channel)).toEqual([older, newer]);
  older.error = null;
  await stops.stop("system", older);
  expect(stops.failures().map(([, channel]) => channel)).toEqual([newer]);
});

test("physical stop rejection remains a barrier on repeated quits even without any audio debt", async () => {
  let stopConfirmed = false;
  const channel = { running: false, error: null as Error | null, shutdownError: null,
    async start() {}, async flush() {}, async stop() { if (!stopConfirmed) throw Error("Helper still alive"); } };
  const audio = new StudioAudio({ chunk: () => channel, realtime: () => channel, wave: async (blob) => blob });
  audio.channels.set("system", channel);
  await expect(audio.stopConfirmed()).rejects.toThrow("Uma fala ficou sem confirmação");
  await expect(audio.stopConfirmed()).rejects.toThrow("Uma fala ficou sem confirmação");
  stopConfirmed = true;
  await audio.stopConfirmed();
  expect(channel.error?.message).toBe("Helper still alive");
});

test("pending history persistence blocks shutdown even when the server sent no locally tracked PCM", async () => {
  const test = environment(), saved = pending();
  await connect(test.state, "display", () => saved.promise, () => {}, options);
  test.message({ type: "final", itemId: "already-buffered", transcript });
  expect(test.state.shutdownError).toBeInstanceOf(Error);
  saved.resolve(); await test.state.deliveries;
  expect(test.state.shutdownError).toBeNull();
});
