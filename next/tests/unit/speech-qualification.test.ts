import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSpeechQualification, type SpeechQualification } from "../support/speech-qualification.ts";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-speech-manifest-"));
  const audio = Buffer.from("metadata-invariant-test-only");
  const manifest: SpeechQualification = { synthetic: true, outputDeviceOpened: false,
    cleanMaximumWer: 0.25, noisyMaximumWer: 0.35, sources: [], fixtures: [] };
  for (const language of ["pt", "en", "es"] as const) {
    for (const engine of ["first", "second"]) {
      const id = `${engine}-${language}`;
      manifest.sources.push({ id, engine, version: "1", voice: id, provenance: "synthetic-unit-only" });
      for (const condition of ["clean", "noisy"] as const) {
        const file = `${id}-${condition}.wav`;
        await writeFile(join(directory, file), audio);
        manifest.fixtures.push({ id: `${id}-${condition}`, sourceId: id, language, condition,
          reference: "Unchanged reference", file, sha256: createHash("sha256").update(audio).digest("hex") });
      }
    }
  }
  const save = () => writeFile(join(directory, "qualification.json"), JSON.stringify(manifest));
  await save();
  return { directory, manifest, save, close: () => rm(directory, { recursive: true, force: true }) };
}

test("qualification validates immutable audio hashes before any inference", async () => {
  const environment = await fixture();
  try {
    expect((await loadSpeechQualification(environment.directory)).manifest.fixtures).toHaveLength(12);
    await writeFile(join(environment.directory, environment.manifest.fixtures[0]!.file), "changed audio");
    await expect(loadSpeechQualification(environment.directory)).rejects.toThrow("fixture_hash_mismatch");
  } finally { await environment.close(); }
});

test("qualification rejects missing independent coverage and unknown fixture sources", async () => {
  const environment = await fixture();
  try {
    environment.manifest.sources.forEach((source) => { source.engine = "same-engine"; });
    await environment.save();
    await expect(loadSpeechQualification(environment.directory)).rejects.toThrow("insufficient_independent_coverage");
    environment.manifest.fixtures[0]!.sourceId = "unregistered";
    await environment.save();
    await expect(loadSpeechQualification(environment.directory)).rejects.toThrow("invalid_fixture_identity");
  } finally { await environment.close(); }
});

test("qualification cannot weaken the original clean and noise thresholds", async () => {
  const environment = await fixture();
  try {
    await writeFile(join(environment.directory, "qualification.json"), JSON.stringify({ ...environment.manifest, cleanMaximumWer: 1 }));
    await expect(loadSpeechQualification(environment.directory)).rejects.toThrow();
  } finally { await environment.close(); }
});
