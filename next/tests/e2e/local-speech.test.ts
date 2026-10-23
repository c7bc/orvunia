import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { composeLocalModels } from "../../packages/local-models/compose.ts";
import { runtimeConfiguration } from "../../packages/local-models/configuration.ts";
import { localModelSchema } from "../../packages/local-models/schema.ts";
import { modelRemovalSchema } from "../../packages/local-models/removal-schema.ts";
import { modelRequestSchema } from "../../packages/local-models/request-schema.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";
import { silenceWave, wordErrorRate } from "../support/speech-metrics.ts";

const fixtureDirectory = process.env.ORVUNIA_TEST_SPEECH_FIXTURES;
const enabled = process.env.ORVUNIA_TEST_MODEL_DOWNLOAD === "1" && Boolean(fixtureDirectory);
const schema = z.object({ source: z.literal("locally-generated-espeak-ng-1.51"), synthetic: z.literal(true),
  outputDeviceOpened: z.literal(false), cleanMaximumWer: z.literal(0.25), noisyMaximumWer: z.literal(0.35),
  fixtures: z.array(z.object({ language: z.enum(["pt", "en", "es"]), reference: z.string().min(1),
    clean: z.string().regex(/^[a-z]+-16k\.wav$/), noisy: z.string().regex(/^[a-z]+-noisy\.wav$/), noiseSnrDb: z.number() })).length(3) });

for (const modelId of ["whisper-tiny", "whisper-base"]) {
  test.skipIf(!enabled)(`real ${modelId} speech quality: PT/EN/ES clean, noise and silence`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "orvunia-speech-quality-"));
    const database = new Database(join(directory, "models.sqlite"));
    database.exec("PRAGMA foreign_keys = ON"); database.exec(localModelSchema); database.exec(modelRemovalSchema); database.exec(modelRequestSchema);
    const runtimes = await runtimeConfiguration(process.env);
    const models = composeLocalModels({ directory, database, bindings: async () => [], runtimes });
    const evidence: Record<string, unknown> = { suite: "local-speech-quality", model: modelId,
      runtimeVersion: runtimes.whisper?.version, runtimeSha256: runtimes.whisper?.sha256,
      nativeCapture: false, outputDeviceOpened: false, measurements: [] };
    try {
      if (!runtimes.whisper) throw new LocalModelError("runtime_unavailable", 503);
      const metadata = await readFile(join(fixtureDirectory!, "fixtures.json"));
      const fixtures = schema.parse(JSON.parse(metadata.toString("utf8")));
      evidence.fixtureManifestSha256 = createHash("sha256").update(metadata).digest("hex");
      evidence.normalization = "NFKC, Unicode lower case, punctuation to space; accents and technical terms unchanged";
      evidence.silenceStrategy = "Exact digital-zero PCM guard before native inference; not voice activity detection";
      evidence.thresholds = { clean: fixtures.cleanMaximumWer, noisy: fixtures.noisyMaximumWer };
      const manifest = models.service.catalog.list("transcription").find((entry) => entry.id === modelId)!;
      evidence.modelRevision = manifest.revision; evidence.modelSha256 = manifest.files[0]!.sha256;
      const download = models.service.downloads.create({ requestId: randomUUID(), catalogId: modelId, revision: manifest.revision });
      expect((await models.service.downloads.run(download.id)).state).toBe("installed");
      evidence.hardware = await models.service.hardware();
      await models.service.lifecycle.load(download.installationId, { contextTokens: 0, maximumOutputTokens: 128, threads: 4 }, new AbortController().signal);
      const measurements = [];
      for (const fixture of fixtures.fixtures) {
        for (const condition of ["clean", "noisy"] as const) {
          const audio = await readFile(join(fixtureDirectory!, fixture[condition]));
          const began = performance.now();
          const transcript = await models.service.lifecycle.transcribe(download.installationId, randomUUID(), audio, fixture.language, new AbortController().signal);
          const metrics = wordErrorRate(fixture.reference, transcript);
          const maximum = condition === "clean" ? fixtures.cleanMaximumWer : fixtures.noisyMaximumWer;
          measurements.push({ language: fixture.language, condition, reference: fixture.reference, transcript,
            fixtureSha256: createHash("sha256").update(audio).digest("hex"), milliseconds: Math.round(performance.now() - began),
            ...metrics, maximumWer: maximum, passed: metrics.wer <= maximum });
        }
        const transcript = await models.service.lifecycle.transcribe(download.installationId, randomUUID(), silenceWave(), fixture.language, new AbortController().signal);
        measurements.push({ language: fixture.language, condition: "silence", transcript, passed: transcript === "" });
      }
      evidence.measurements = measurements;
      evidence.status = measurements.every((entry) => entry.passed) ? "passed" : "failed-quality";
      await models.service.lifecycle.unload(download.installationId);
      await models.service.lifecycle.remove(download.installationId, 1, randomUUID());
      evidence.uninstalled = !await models.service.artifacts.has(manifest.files[0]!);
      expect(measurements.filter((entry) => !entry.passed)).toEqual([]);
      evidence.limitations = ["One eSpeak voice per language, not population-level quality", "One sample per condition, not p95 latency", "No microphone or native loopback capture"];
    } catch (error) {
      if (!evidence.status) evidence.status = error instanceof LocalModelError && error.code === "hardware_incompatible" ? "blocked-hardware" : "failed";
      evidence.error = error instanceof Error ? error.message : "unknown"; throw error;
    } finally {
      await models.close(); database.close(); await rm(directory, { recursive: true, force: true });
      if (process.env.ORVUNIA_TEST_SPEECH_REPORT_DIRECTORY)
        await writeFile(join(process.env.ORVUNIA_TEST_SPEECH_REPORT_DIRECTORY, `${modelId}-quality.json`), JSON.stringify(evidence, null, 2));
    }
  }, 300_000);
}
