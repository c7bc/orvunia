import type { ChildProcess } from "node:child_process";
import { ownedProcessAlive, probeOwnedMemory, type MemoryProbe } from "./memory-probe.ts";

export type MemorySummary = { bytes: number | null; samples: number; source: string | null; unavailableReasons: string[] };
export type MemorySampler = { stop(): Promise<MemorySummary> };
export function sampleOwnedMemory(child: ChildProcess, probe: MemoryProbe = probeOwnedMemory): MemorySampler {
  let identity: string | null = null;
  let source: string | null = null;
  let peak: number | null = null;
  let samples = 0;
  let failures = 0;
  let stopped = false;
  let pending: Promise<void> | null = null;
  const sample = () => {
    if (stopped || pending || !ownedProcessAlive(child)) return;
    pending = Promise.resolve().then(() => probe(child, AbortSignal.timeout(750))).then(reading => {
      if (identity !== null && identity !== reading.identity) throw Error("memory_process_identity_changed");
      identity = reading.identity; source = reading.source;
      peak = Math.max(peak ?? 0, reading.bytes); samples++;
    }).catch(() => { failures++; }).finally(() => { pending = null; });
  };
  sample();
  const timer = setInterval(sample, 50);
  timer.unref?.();
  return { async stop() {
    clearInterval(timer);
    await pending;
    sample();
    stopped = true;
    await pending;
    return { bytes: peak, samples, source, unavailableReasons: samples === 0
      ? ["resident-memory:owned-process-probe-unavailable"]
      : failures ? ["resident-memory:partial-probe-failure"] : [] };
  } };
}
