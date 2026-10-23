import { expect, test } from "bun:test";
import { assessCompatibility } from "../../packages/local-models/compatibility.ts";
import { CuratedCatalog } from "../../packages/local-models/catalog.ts";
import type { HardwareSnapshot } from "../../packages/local-models/domain.ts";
import { syntheticManifest } from "../support/local-models.ts";

const hardware: HardwareSnapshot = { measuredAt: "2026-10-19T00:00:00Z", architecture: "x64", processors: 4,
  totalMemoryBytes: 8 * 1024 ** 3, availableMemoryBytes: 6 * 1024 ** 3, freeDiskBytes: 20 * 1024 ** 3,
  acceleration: "cpu", unavailableFields: ["gpu-memory"] };
const request = { contextTokens: 1024, enabledCapabilities: ["text"] as ["text"], simultaneousMemoryBytes: 0 };

test("uncalibrated candidates are never presented as recommended", () => {
  const result = assessCompatibility(syntheticManifest(), hardware, request);
  expect(result.verdict).toBe("not-verified");
  expect(result.reasonCodes).toContain("model-not-verified");
  expect(result.reasonCodes).toContain("cpu-fallback");
});
test("available memory, disk, context, capability and simultaneous loads gate compatibility", () => {
  expect(assessCompatibility(syntheticManifest(), { ...hardware, availableMemoryBytes: 100 }, request).reasonCodes).toContain("ram-insufficient");
  expect(assessCompatibility(syntheticManifest(), { ...hardware, freeDiskBytes: 1 }, request).reasonCodes).toContain("disk-insufficient");
  expect(assessCompatibility(syntheticManifest(), hardware, { ...request, contextTokens: 5000 }).verdict).toBe("incompatible");
  expect(assessCompatibility(syntheticManifest(), hardware, { ...request, enabledCapabilities: ["vision"] }).reasonCodes).toContain("capability-unavailable");
  expect(assessCompatibility(syntheticManifest(), hardware, { ...request, simultaneousMemoryBytes: 8 * 1024 ** 3 }).reasonCodes).toContain("simultaneous-load");
});
test("unknown GPU does not make a CPU model incompatible; unknown RAM stays unverified", () => {
  expect(assessCompatibility(syntheticManifest(), hardware, request).verdict).not.toBe("incompatible");
  expect(assessCompatibility(syntheticManifest(), { ...hardware, availableMemoryBytes: 0 }, request).reasonCodes).toContain("unknown-memory");
});
test("curated files have immutable official-source revisions, bytes and integrity hashes", () => {
  const catalog = new CuratedCatalog();
  expect(catalog.list()).toHaveLength(7);
  for (const manifest of catalog.list()) {
    expect(manifest.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(manifest.evaluation).toBe("not-verified");
    for (const file of manifest.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.url).toContain(`/resolve/${manifest.revision}/`);
      expect(file.bytes).toBeGreaterThan(0);
    }
  }
  const first = catalog.list()[0]!; first.name = "mutated";
  expect(catalog.list()[0]!.name).not.toBe("mutated");
  expect(() => catalog.find("whisper-tiny", "moving-main")).toThrow("catalog_revision_unavailable");
});
