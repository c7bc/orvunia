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

const binary = process.env.ORVUNIA_TEST_LLAMA_BINARY;
const binaryHash = process.env.ORVUNIA_TEST_LLAMA_SHA256;
const imagePath = process.env.ORVUNIA_TEST_IMAGE_FIXTURE;
const enabled = process.env.ORVUNIA_TEST_MODEL_DOWNLOAD === "1" && !!binary && !!binaryHash && !!imagePath;

test.skipIf(!enabled)("real SmolVLM: pinned weights and projector, text, vision, offline restart and deletion", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-vision-e2e-"));
  let database = new Database(join(directory, "models.sqlite"));
  database.exec("PRAGMA foreign_keys = ON"); database.exec(localModelSchema);
  database.exec(modelRemovalSchema);
  database.exec(modelRequestSchema);
  const runtimes = { llama: { path: binary!, sha256: binaryHash!, version: "b11734" } };
  let composition = composeLocalModels({ directory, database, bindings: async () => [], runtimes });
  const evidence: Record<string, unknown> = { suite: "local-vision", runtime: "llama.cpp", runtimeVersion: "b11734",
    runtimeSha256: binaryHash, model: "smolvlm-256m-q8", fixture: "synthetic-solid-red-png", status: "running" };
  try {
    const manifest = composition.service.catalog.list("vision").find((model) => model.id === "smolvlm-256m-q8")!;
    evidence.modelRevision = manifest.revision; evidence.artifacts = manifest.files.map(({ sha256, bytes, role }) => ({ sha256, bytes, role }));
    const job = composition.service.downloads.create({ requestId: randomUUID(), catalogId: manifest.id, revision: manifest.revision });
    const start = performance.now(); const installed = await composition.service.downloads.run(job.id);
    expect(installed.state).toBe("installed"); evidence.downloadMilliseconds = Math.round(performance.now() - start);
    const settings = { contextTokens: 2048, maximumOutputTokens: 64, threads: 4 };
    await composition.service.lifecycle.load(job.installationId, settings, new AbortController().signal);
    const text = await composition.service.lifecycle.generate(job.installationId, randomUUID(), {
      instructions: "Answer the question directly and briefly.", prompt: "What is 2 + 3? Answer with a single digit.", images: [],
    }, new AbortController().signal);
    evidence.textResponse = text; expect(text).toMatch(/5/);
    const image = await readFile(imagePath!); evidence.fixtureSha256 = createHash("sha256").update(image).digest("hex");
    const visionStart = performance.now();
    const vision = await composition.service.lifecycle.generate(job.installationId, randomUUID(), {
      instructions: "Describe the visible image without inventing details.", prompt: "What color fills the image? Answer with a single color word.",
      images: [{ mime: "image/png", data: image }],
    }, new AbortController().signal);
    evidence.visionResponse = vision; evidence.visionInferenceMilliseconds = Math.round(performance.now() - visionStart);
    expect(vision.toLowerCase()).toContain("red");
    await composition.close(); database.close();
    const previousFetch = globalThis.fetch;
    let deniedRemoteRequests = 0;
    globalThis.fetch = new Proxy(previousFetch, { apply(target, receiver, argumentsList: Parameters<typeof fetch>) {
      const destination = new URL(String(argumentsList[0] instanceof Request ? argumentsList[0].url : argumentsList[0]));
      if (destination.hostname !== "127.0.0.1") { deniedRemoteRequests++; throw Error("Remote transport denied during restart"); }
      return Reflect.apply(target, receiver, argumentsList);
    } });
    try {
      database = new Database(join(directory, "models.sqlite"));
      composition = composeLocalModels({ directory, database, bindings: async () => [], runtimes });
      await composition.service.lifecycle.load(job.installationId, settings, new AbortController().signal);
      const repeated = await composition.service.lifecycle.generate(job.installationId, randomUUID(), {
        instructions: "Describe the visible image without inventing details.", prompt: "What color fills the image? Answer with a single color word.",
        images: [{ mime: "image/png", data: image }],
      }, new AbortController().signal);
      evidence.restartVisionResponse = repeated; expect(repeated.toLowerCase()).toContain("red");
      evidence.restartRemoteRequests = deniedRemoteRequests; expect(deniedRemoteRequests).toBe(0);
    } finally { globalThis.fetch = previousFetch; }
    await composition.service.lifecycle.unload(job.installationId);
    await composition.service.lifecycle.remove(job.installationId, 1);
    for (const file of manifest.files) expect(await composition.service.artifacts.has(file)).toBe(false);
    expect(composition.service.lifecycle.status()).toEqual([]);
    evidence.status = "passed"; evidence.uninstalled = true;
    evidence.limitations = ["Synthetic color recognition, not OCR/code quality approval", "No PT/ES evaluation", "Transport guard, not OS firewall", "One run, not p95 latency benchmark"];
  } catch (error) { evidence.status = "failed"; evidence.error = error instanceof Error ? error.message : "unknown"; throw error; }
  finally {
    await composition.close(); database.close();
    if (process.env.ORVUNIA_TEST_VISION_REPORT) await writeFile(process.env.ORVUNIA_TEST_VISION_REPORT, JSON.stringify(evidence, null, 2));
    await rm(directory, { recursive: true, force: true });
  }
}, 300_000);
