import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeLocalModels } from "../../packages/local-models/compose.ts";
import { runtimeConfiguration } from "../../packages/local-models/configuration.ts";
import { localModelSchema } from "../../packages/local-models/schema.ts";
import { modelRemovalSchema } from "../../packages/local-models/removal-schema.ts";
import { modelRequestSchema } from "../../packages/local-models/request-schema.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";
import { loadSpeechQualification } from "../support/speech-qualification.ts";
import { silenceWave, wordErrorRate } from "../support/speech-metrics.ts";

const fixtures = process.env.ORVUNIA_TEST_ASR_QUALIFICATION;
const weights = process.env.ORVUNIA_TEST_ASR_WEIGHTS_DIRECTORY;
const reports = process.env.ORVUNIA_TEST_ASR_REPORT_DIRECTORY;
const enabled = Boolean(fixtures && weights && reports);
const requested = (process.env.ORVUNIA_TEST_ASR_MODELS ?? "whisper-small-q5_1").split(",");
for (const modelId of requested) {
  test.skipIf(!enabled)(`real speech qualification ${modelId}: immutable fixtures without transcript prompts`, async () => {
    const qualification = await loadSpeechQualification(fixtures!);
    const directory = await mkdtemp(join(tmpdir(), "orvunia-asr-qualification-"));
    const database = new Database(join(directory, "models.sqlite"));
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(localModelSchema); database.exec(modelRemovalSchema); database.exec(modelRequestSchema);
    const runtimes = await runtimeConfiguration(process.env);
    const models = composeLocalModels({ directory, database, bindings: async () => [], runtimes });
    const measurements: Record<string, unknown>[] = [];
    const evidence: Record<string, unknown> = { suite: "asr-independent-qualification", modelId,
      fixtureManifestSha256: qualification.sha256, sources: qualification.manifest.sources,
      thresholds: { clean: 0.25, noisy: 0.35 }, transcriptPrompt: false, outputDeviceOpened: false,
      runtimeVersion: runtimes.whisper?.version, runtimeSha256: runtimes.whisper?.sha256,
      measurements, limitations: ["Synthetic voices, not population-level quality", "Single run, not p95 latency", "No microphone or system loopback"] };
    try {
      const manifest = models.service.catalog.list("transcription").find((entry) => entry.id === modelId);
      if (!manifest) throw new Error("unknown_qualification_model");
      evidence.modelRevision = manifest.revision; evidence.modelSha256 = manifest.files[0]!.sha256;
      const filename = `ggml-${modelId.slice("whisper-".length)}.bin`;
      const selectionId = await models.service.selections.grant("qualification", join(weights!, filename));
      const installed = await models.service.imports.import("qualification", { requestId: randomUUID(), selectionId,
        catalogId: modelId, revision: manifest.revision }, new AbortController().signal);
      expect(installed.state).toBe("installed");
      evidence.hardware = await models.service.hardware();
      await models.service.lifecycle.load(installed.installationId, { contextTokens: 0, maximumOutputTokens: 128, threads: 4 }, new AbortController().signal);
      for (const fixture of qualification.manifest.fixtures) {
        const audio = await readFile(join(fixtures!, fixture.file));
        const began = performance.now();
        const transcript = await models.service.lifecycle.transcribe(installed.installationId, randomUUID(), audio,
          fixture.language, new AbortController().signal);
        const metrics = wordErrorRate(fixture.reference, transcript);
        const maximum = fixture.condition === "clean" ? 0.25 : 0.35;
        measurements.push({ ...fixture, transcript, ...metrics, maximumWer: maximum,
          milliseconds: Math.round(performance.now() - began), passed: metrics.wer <= maximum });
      }
      for (const language of ["pt", "en", "es"]) {
        const transcript = await models.service.lifecycle.transcribe(installed.installationId, randomUUID(), silenceWave(), language, new AbortController().signal);
        measurements.push({ language, condition: "digital-silence", transcript, passed: transcript === "" });
      }
      evidence.status = measurements.every((entry) => entry.passed) ? "passed-fixtures" : "failed-quality";
      await models.service.lifecycle.unload(installed.installationId);
      await models.service.lifecycle.remove(installed.installationId, 1, randomUUID());
      evidence.uninstalled = !await models.service.artifacts.has(manifest.files[0]!);
      expect(measurements.filter((entry) => !entry.passed)).toEqual([]);
    } catch (error) {
      evidence.status ??= error instanceof LocalModelError && error.code === "hardware_incompatible" ? "blocked-hardware" : "failed-infrastructure";
      evidence.error = error instanceof Error ? error.message : "unknown";
      throw error;
    } finally {
      await models.close(); database.close(); await rm(directory, { recursive: true, force: true });
      await writeFile(join(reports!, `${modelId}-qualification.json`), JSON.stringify(evidence, null, 2));
    }
  }, 600_000);
}
