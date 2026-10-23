import { expect, test } from "bun:test";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { capabilityEnvironment } from "../support/capability-environment.ts";

const binary = process.env.ORVUNIA_TEST_LLAMA_BINARY;
const binaryHash = process.env.ORVUNIA_TEST_LLAMA_SHA256;
const imagePath = process.env.ORVUNIA_TEST_CODE_FIXTURE;
const enabled = process.env.ORVUNIA_TEST_MODEL_DOWNLOAD === "1" && !!binary && !!binaryHash && !!imagePath;

test.skipIf(!enabled)("real Qwen3.5 technical screenshot resolves through snapshot, local router and history", async () => {
  const environment = await capabilityEnvironment({ llama: { path: binary!, sha256: binaryHash!, version: "b11734" } });
  const evidence: Record<string, unknown> = { suite: "local-technical-inference", runtime: "llama.cpp b11734", model: "qwen3.5-0.8b-q4",
    source: "unsloth-primary-quantizer", expected: "[4,8,12]", nativeCapture: false };
  try {
    const manifest = environment.models.service.catalog.list().find((entry) => entry.id === "qwen3.5-0.8b-q4")!;
    evidence.revision = manifest.revision; evidence.artifacts = manifest.files.map(({ role, bytes, sha256 }) => ({ role, bytes, sha256 }));
    const download = environment.models.service.downloads.create({ requestId: randomUUID(), catalogId: manifest.id, revision: manifest.revision });
    const downloadStart = performance.now();
    expect((await environment.models.service.downloads.run(download.id)).state).toBe("installed");
    evidence.downloadMilliseconds = Math.round(performance.now() - downloadStart);
    environment.change((configuration) => {
      configuration.bindings.text = { kind: "local", installationId: download.installationId };
      configuration.bindings.vision = { kind: "shared", capability: "text" };
    });
    const image = await readFile(imagePath!); evidence.fixtureSha256 = createHash("sha256").update(image).digest("hex");
    expect(evidence.fixtureSha256).toBe("93e0c40b36fa6cf078782f25d9469f0a796a4e67b0be0474b53a3db99e908345");
    const capture = await environment.imageService.upload(environment.owner, environment.session.id, {
      data: image, mime: "image/png", title: "Synthetic TypeScript map question", time: "00:01", requestKey: randomUUID(),
    });
    environment.input.captureIds = [capture.id];
    environment.input.question = "Answer the question shown in the screenshot. State the printed array and explain the transformation.";
    const prepared = await environment.prepare();
    evidence.instructionsBytes = Buffer.byteLength(prepared.snapshot!.instructions);
    const started = performance.now(); const result = await environment.run(prepared);
    evidence.inferenceMilliseconds = Math.round(performance.now() - started); evidence.answer = result.text;
    expect(result.text).toMatch(/\[\s*4\s*,\s*8\s*,\s*12\s*\]/);
    expect(result.text.toLowerCase()).toMatch(/multipli|dobr|double|\*\s*2/);
    const entries = await environment.sessions.entries(environment.owner, environment.session.id, "responses", { limit: 10 });
    expect(entries).toHaveLength(1); expect(entries[0]!.data.text).toBe(result.text);
    expect(environment.requests).toHaveLength(0);
    expect((await environment.run(await environment.prepare())).text).toBe(result.text);
    await environment.models.service.lifecycle.unload(download.installationId);
    environment.input.requestId = randomUUID();
    const second = await environment.run(await environment.prepare()); evidence.afterRuntimeRestart = second.text;
    expect(second.text).toMatch(/\[\s*4\s*,\s*8\s*,\s*12\s*\]/);
    expect(environment.requests).toHaveLength(0);
    await environment.models.service.lifecycle.unload(download.installationId);
    environment.change((configuration) => { configuration.bindings.text = { kind: "disabled" }; configuration.bindings.vision = { kind: "disabled" }; });
    await environment.models.service.lifecycle.remove(download.installationId, 1, randomUUID());
    for (const file of manifest.files) expect(await environment.models.service.artifacts.has(file)).toBe(false);
    evidence.status = "passed"; evidence.apiProviderRequests = 0; evidence.uninstalled = true;
    evidence.limitations = ["Single controlled TypeScript screenshot; no broad OCR/benchmark approval", "Runtime restart, not full backend restart", "No OS firewall; all inference endpoints are loopback", "No native screenshot capture"];
  } catch (error) { evidence.status = "failed"; evidence.error = error instanceof Error ? error.message : "unknown"; throw error; }
  finally {
    await environment.close();
    if (process.env.ORVUNIA_TEST_TECHNICAL_REPORT) await writeFile(process.env.ORVUNIA_TEST_TECHNICAL_REPORT, JSON.stringify(evidence, null, 2));
  }
}, 300_000);
