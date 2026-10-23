import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { composeLocalModels } from "../../packages/local-models/compose.ts";
import { localModelSchema } from "../../packages/local-models/schema.ts";
import { modelRemovalSchema } from "../../packages/local-models/removal-schema.ts";
import { modelRequestSchema } from "../../packages/local-models/request-schema.ts";

const binary = process.env.ORVUNIA_TEST_WHISPER_BINARY;
const binaryHash = process.env.ORVUNIA_TEST_WHISPER_SHA256;
const fixturePath = process.env.ORVUNIA_TEST_AUDIO_FIXTURE;
const enabled = process.env.ORVUNIA_TEST_MODEL_DOWNLOAD === "1" && !!binary && !!binaryHash && !!fixturePath;

test.skipIf(!enabled)("real Whisper tiny: pinned download, transcript, restart without transport, unload and uninstall", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-whisper-e2e-"));
  let database = new Database(join(directory, "models.sqlite"));
  database.exec("PRAGMA foreign_keys = ON"); database.exec(localModelSchema);
  database.exec(modelRemovalSchema);
  database.exec(modelRequestSchema);
  const runtimes = { whisper: { path: binary!, sha256: binaryHash!, version: "v1.8.4" } };
  let composition = composeLocalModels({ directory, database, bindings: async () => [], runtimes });
  const evidence: Record<string, unknown> = { suite: "local-inference", runtime: "whisper.cpp", runtimeVersion: "v1.8.4",
    runtimeSha256: binaryHash, model: "whisper-tiny", source: "public-repository-jfk", actualCapture: false };
  try {
    const manifest = composition.service.catalog.list("transcription").find((model) => model.id === "whisper-tiny")!;
    evidence.modelRevision = manifest.revision; evidence.modelSha256 = manifest.files[0]!.sha256;
    const job = composition.service.downloads.create({ requestId: randomUUID(), catalogId: manifest.id, revision: manifest.revision });
    const started = performance.now();
    const installed = await composition.service.downloads.run(job.id);
    expect(installed.state).toBe("installed");
    evidence.downloadMilliseconds = Math.round(performance.now() - started);
    const audio = await readFile(fixturePath!);
    evidence.fixtureSha256 = createHash("sha256").update(audio).digest("hex");
    const settings = { contextTokens: 0, maximumOutputTokens: 128, threads: 4 };
    await composition.service.lifecycle.load(job.installationId, settings, new AbortController().signal);
    const firstStart = performance.now();
    const first = await composition.service.lifecycle.transcribe(job.installationId, randomUUID(), audio, "en", new AbortController().signal);
    expect(first.toLowerCase()).toContain("country");
    evidence.firstInferenceMilliseconds = Math.round(performance.now() - firstStart);
    evidence.transcript = first;
    await composition.close(); database.close();
    database = new Database(join(directory, "models.sqlite"));
    composition = composeLocalModels({ directory, database, bindings: async () => [], runtimes });
    expect(await composition.installationSupports(job.installationId, "transcription")).toBe(true);
    const previousFetch = globalThis.fetch;
    globalThis.fetch = new Proxy(previousFetch, { apply() { throw Error("Network disabled by test transport guard"); } });
    try {
      await composition.service.lifecycle.load(job.installationId, settings, new AbortController().signal);
      const second = await composition.service.lifecycle.transcribe(job.installationId, randomUUID(), audio, "en", new AbortController().signal);
      expect(second.toLowerCase()).toContain("country");
      evidence.restartInferenceWithoutFetch = true;
    } finally { globalThis.fetch = previousFetch; }
    await composition.service.lifecycle.unload(job.installationId);
    const installation = composition.service.registry.findInstallation(job.installationId)!;
    await composition.service.lifecycle.remove(job.installationId, installation.revision);
    expect(composition.service.registry.findInstallation(job.installationId)?.state).toBe("deleted");
    expect(await composition.service.artifacts.has(manifest.files[0]!)).toBe(false);
    expect(composition.service.lifecycle.status()).toEqual([]);
    evidence.uninstalled = true; evidence.status = "passed";
    evidence.limitations = ["One English public speech fixture; no PT/ES quality approval", "No microphone or native loopback capture", "Fetch guard does not represent an OS firewall", "Not a latency percentile benchmark"];
  } catch (error) {
    evidence.status = "failed"; evidence.error = error instanceof Error ? error.message : "unknown";
    throw error;
  } finally {
    await composition.close(); database.close();
    if (process.env.ORVUNIA_TEST_MODEL_REPORT) await writeFile(process.env.ORVUNIA_TEST_MODEL_REPORT, JSON.stringify(evidence, null, 2));
    await rm(directory, { recursive: true, force: true });
  }
}, 300_000);
