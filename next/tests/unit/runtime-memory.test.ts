import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { createMemoryProbe, linuxMemory, windowsMemory } from "../../packages/local-models/memory-probe.ts";
import { sampleOwnedMemory } from "../../packages/local-models/memory-sampler.ts";

function child() { return { pid: 4242, exitCode: null, signalCode: null } as ChildProcess; }
const stat = `4242 (own worker name) S ${Array(18).fill("0").join(" ")} 98765 0 0`;
test("Linux VmRSS KiB and Windows working set bytes preserve process identity and reject malformed measurements", () => {
  expect(linuxMemory(stat, "Name:\tworker\nVmRSS:\t1024 kB\n")).toEqual({ bytes: 1024 ** 2, identity: "98765", source: "linux-proc-vmrss" });
  expect(windowsMemory('{"bytes":123456,"identity":"1234"}')).toEqual({ bytes: 123456, identity: "1234", source: "windows-workingset" });
  for (const value of ['{"bytes":-1,"identity":"1234"}', '{"bytes":1e999,"identity":"1234"}', '{"bytes":"99","identity":"1234"}'])
    expect(() => windowsMemory(value)).toThrow("memory_probe_invalid");
  expect(() => linuxMemory(stat, "VmRSS: invalid kB")).toThrow("memory_probe_invalid");
});

test("memory probes access only the owned child PID and recheck exit before accepting a reading", async () => {
  const owned = child(); const paths: string[] = [];
  const probe = createMemoryProbe({ platform: "linux", async read(path) {
    paths.push(path); return path.endsWith("stat") ? stat : "VmRSS: 10 kB";
  }, async windows() { throw Error("Wrong platform"); } });
  expect((await probe(owned, new AbortController().signal)).bytes).toBe(10240);
  expect(paths.sort()).toEqual(["/proc/4242/stat", "/proc/4242/status"]);
  Reflect.set(owned, "exitCode", 0);
  await expect(probe(owned, new AbortController().signal)).rejects.toThrow("memory_process_unavailable");
  expect(paths).toHaveLength(2);
  const running = child();
  const exiting = createMemoryProbe({ platform: "win32", async read() { throw Error("No inventory"); }, async windows(pid) {
    expect(pid).toBe(4242); Reflect.set(running, "signalCode", "SIGTERM"); return '{"bytes":55,"identity":"1"}';
  } });
  await expect(exiting(running, new AbortController().signal)).rejects.toThrow("memory_process_unavailable");
});

test("sampler records a sampled maximum, counts probes and rejects PID identity changes without inventing zero RAM", async () => {
  let calls = 0;
  const sampler = sampleOwnedMemory(child(), async () => ({ bytes: ++calls * 100, identity: "own", source: "linux-proc-vmrss" }));
  expect(await sampler.stop()).toEqual({ bytes: 200, samples: 2, source: "linux-proc-vmrss", unavailableReasons: [] });
  let changedCalls = 0;
  const changed = sampleOwnedMemory(child(), async () => ({ bytes: ++changedCalls * 100,
    identity: changedCalls === 1 ? "own" : "reused", source: "linux-proc-vmrss" }));
  expect(await changed.stop()).toMatchObject({ bytes: 100, samples: 1, unavailableReasons: ["resident-memory:partial-probe-failure"] });
  const failed = sampleOwnedMemory(child(), async () => { throw Error("Permission denied"); });
  expect(await failed.stop()).toEqual({ bytes: null, samples: 0, source: null,
    unavailableReasons: ["resident-memory:owned-process-probe-unavailable"] });
});

test("sampler stop is bounded by an abort-aware own-process probe and leaves no active sampler", async () => {
  let aborted = 0;
  const sampler = sampleOwnedMemory(child(), (_child, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted++; reject(signal.reason); }, { once: true });
  }));
  const result = await sampler.stop();
  expect(aborted).toBe(2); expect(result.samples).toBe(0); expect(result.bytes).toBeNull();
  expect(await sampler.stop()).toEqual(result);
}, 4000);
