import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as filesystem from "node:fs/promises";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import * as processPorts from "../../packages/local-models/process.ts";
import { WhisperRuntime } from "../../packages/local-models/whisper.ts";
import { silenceWave } from "../support/speech-metrics.ts";

afterEach(() => mock.restore());
function fixture() {
  const runtime = new WhisperRuntime({ path: "synthetic-not-launched", sha256: "0".repeat(64), version: "fixture" });
  const loaded = { handle: { id: "synthetic-loaded-handle" }, weights: "synthetic-not-opened", threads: 4, users: 0 };
  Reflect.set(runtime, "loaded", loaded);
  const completions: (() => void)[] = [];
  spyOn(processPorts, "verifyRuntime").mockResolvedValue(undefined);
  const spawn = spyOn(processPorts, "spawnRuntime").mockImplementation(() => new EventEmitter() as ChildProcess);
  spyOn(processPorts, "processCompletion").mockImplementation(() => new Promise(resolve => { completions.push(() => resolve(0)); }));
  const stop = spyOn(processPorts, "stopOwnedProcess").mockResolvedValue(undefined);
  spyOn(filesystem, "readFile").mockResolvedValue(Buffer.from("Useful synthetic speech"));
  const wave = silenceWave(1); wave[44] = 1;
  const run = (id: string, signal = new AbortController().signal) => runtime.transcribe(loaded.handle.id, id, wave, "pt", signal);
  const until = async (condition: () => boolean) => {
    const deadline = performance.now() + 5000;
    while (!condition()) { if (performance.now() > deadline) throw Error("Fixture did not advance"); await Bun.sleep(1); }
  };
  return { runtime, loaded, run, spawn, stop, completions, until };
}

test("five synchronous requests launch one synthetic child, retain two users and drain the queued child in order", async () => {
  const f = fixture();
  const first = f.run("first"), second = f.run("second");
  for (const id of ["third", "fourth", "fifth", "first"])
    await expect(f.run(id)).rejects.toThrow("runtime_busy");
  expect(f.loaded.users).toBe(2);
  await expect(f.runtime.unload(f.loaded.handle.id)).rejects.toThrow("runtime_in_use");
  await f.until(() => f.spawn.mock.calls.length === 1);
  f.completions[0]!(); expect(await first).toBe("Useful synthetic speech");
  await f.until(() => f.spawn.mock.calls.length === 2);
  expect(f.loaded.users).toBe(1);
  f.completions[1]!(); expect(await second).toBe("Useful synthetic speech");
  expect(f.loaded.users).toBe(0); expect(f.stop).toHaveBeenCalledTimes(2);
  await f.runtime.unload(f.loaded.handle.id);
});

test("cancelled queued job never spawns and replacement waits for active cleanup", async () => {
  const f = fixture(), first = f.run("first"), second = f.run("second");
  const rejected = second.catch((error: unknown) => error);
  f.runtime.cancel("second"); expect(await rejected).toMatchObject({ name: "AbortError" });
  const third = f.run("third");
  await f.until(() => f.spawn.mock.calls.length === 1);
  expect(f.loaded.users).toBe(2);
  f.completions[0]!(); await first;
  await f.until(() => f.spawn.mock.calls.length === 2);
  f.completions[1]!(); await third; expect(f.loaded.users).toBe(0);
});

test("queued execution and unload remain fenced until owned-child shutdown and temporary cleanup both finish", async () => {
  const f = fixture();
  let allowStop: () => void = () => {}, allowRemoval: () => void = () => {};
  const stopping = new Promise<void>(resolve => { allowStop = resolve; });
  const removing = new Promise<void>(resolve => { allowRemoval = resolve; });
  const actualRemove = filesystem.rm;
  f.stop.mockImplementationOnce(() => stopping);
  const remove = spyOn(filesystem, "rm").mockImplementationOnce(async (path, options) => {
    await removing; return actualRemove(path, options);
  });
  const first = f.run("first"), second = f.run("second");
  await f.until(() => f.spawn.mock.calls.length === 1);
  f.completions[0]!(); await f.until(() => f.stop.mock.calls.length === 1);
  expect(f.spawn).toHaveBeenCalledTimes(1); expect(f.loaded.users).toBe(2);
  await expect(f.runtime.unload(f.loaded.handle.id)).rejects.toThrow("runtime_in_use");
  allowStop(); await f.until(() => remove.mock.calls.length === 1);
  expect(f.spawn).toHaveBeenCalledTimes(1); expect(f.loaded.users).toBe(2);
  allowRemoval(); await first;
  await f.until(() => f.spawn.mock.calls.length === 2);
  f.completions[1]!(); await second; expect(f.loaded.users).toBe(0);
});

for (const phase of ["mkdtemp", "writeFile", "verifyRuntime"] as const)
  test(`failure in ${phase} releases admission and users before the next attempt`, async () => {
    const f = fixture();
    if (phase === "verifyRuntime") spyOn(processPorts, phase).mockRejectedValueOnce(Error("Synthetic failure"));
    else spyOn(filesystem, phase).mockRejectedValueOnce(Error("Synthetic failure"));
    await expect(f.run("failed")).rejects.toThrow("Synthetic failure");
    expect(f.loaded.users).toBe(0); expect(f.spawn).toHaveBeenCalledTimes(0);
    const next = f.run("next"); await f.until(() => f.spawn.mock.calls.length === 1);
    f.completions[0]!(); await next; expect(f.loaded.users).toBe(0);
  });
