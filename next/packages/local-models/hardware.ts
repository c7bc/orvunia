import { availableParallelism, freemem, totalmem } from "node:os";
import { statfs } from "node:fs/promises";
import type { HardwareSnapshot } from "./domain.ts";

export async function probeHardware(storageDirectory: string): Promise<HardwareSnapshot> {
  let freeDiskBytes: number | null = null;
  try {
    const disk = await statfs(storageDirectory, { bigint: true });
    const bytes = disk.bavail * disk.bsize;
    freeDiskBytes = bytes <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bytes) : null;
  } catch { /* A missing mount is reported as unknown rather than available. */ }
  return {
    measuredAt: new Date().toISOString(), architecture: process.arch,
    processors: availableParallelism(), totalMemoryBytes: totalmem(), availableMemoryBytes: freemem(),
    freeDiskBytes, acceleration: "cpu", unavailableFields: ["gpu-memory", "gpu-backend", ...(freeDiskBytes === null ? ["disk"] : [])],
  };
}
