import type { Compatibility, CompatibilityRequest, HardwareSnapshot, ModelManifest } from "./domain.ts";

const gibibyte = 1024 ** 3;
export function assessCompatibility(
  manifest: ModelManifest,
  hardware: HardwareSnapshot,
  request: CompatibilityRequest,
  verifiedBlobBytes = 0,
): Compatibility {
  const reasons: string[] = [];
  const weightBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  const context = Math.max(0, request.contextTokens);
  const visual = request.enabledCapabilities.includes("vision") ? manifest.memory.visualBytes : 0;
  const estimated = weightBytes + manifest.memory.fixedBytes + visual +
    context * manifest.memory.bytesPerContextToken + request.simultaneousMemoryBytes;
  const disk = Math.max(0, 2 * weightBytes - verifiedBlobBytes);
  const incompatible = [];
  if (!Number.isSafeInteger(context) || context > manifest.maximumContext) incompatible.push("context-too-large");
  if (request.enabledCapabilities.some((value) => !manifest.capabilities.includes(value)))
    incompatible.push("capability-unavailable");
  if (hardware.freeDiskBytes !== null && hardware.freeDiskBytes < disk) incompatible.push("disk-insufficient");
  if (hardware.availableMemoryBytes <= 0) reasons.push("unknown-memory");
  else if (estimated + Math.min(gibibyte, hardware.totalMemoryBytes * 0.15) > hardware.availableMemoryBytes)
    incompatible.push(request.simultaneousMemoryBytes ? "simultaneous-load" : "ram-insufficient");
  if (!["x64", "arm64"].includes(hardware.architecture)) incompatible.push("backend-unavailable");
  if (hardware.acceleration === "cpu") reasons.push("cpu-fallback");
  if (hardware.freeDiskBytes === null) reasons.push("unknown-disk");
  if (!manifest.memory.calibrated || manifest.evaluation !== "verified") reasons.push("model-not-verified");
  const verdict = incompatible.length ? "incompatible" :
    reasons.some((reason) => reason.startsWith("unknown-") || reason === "model-not-verified") ? "not-verified" :
      hardware.acceleration === "cpu" ? "may-be-slow" : "recommended";
  return { verdict, reasonCodes: [...incompatible, ...reasons], estimatedMemoryBytes: estimated, requiredDiskBytes: disk };
}
