import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { recordedTranscription } from "../../packages/transcription/service.ts";

const binary = process.env.ORVUNIA_TEST_WHISPER_BINARY;
const binaryHash = process.env.ORVUNIA_TEST_WHISPER_SHA256;
const fixturePath = process.env.ORVUNIA_TEST_AUDIO_FIXTURE;
const enabled = process.env.ORVUNIA_TEST_MODEL_DOWNLOAD === "1" && !!binary && !!binaryHash && !!fixturePath;

test.skipIf(!enabled)("real local Whisper runs through capability snapshot, recorded service and persisted history", async () => {
  const environment = await capabilityEnvironment({ whisper: { path: binary!, sha256: binaryHash!, version: "v1.8.4" } });
  const audio = recordedTranscription({ ...environment.dependencies, local: true });
  const evidence: Record<string, unknown> = { suite: "local-transcription-history", runtime: "whisper.cpp v1.8.4",
    model: "whisper-tiny", nativeCapture: false, source: "public-jfk-wave-fixture" };
  try {
    const manifest = environment.models.service.catalog.list().find((entry) => entry.id === "whisper-tiny")!;
    const job = environment.models.service.downloads.create({ requestId: randomUUID(), catalogId: manifest.id, revision: manifest.revision });
    expect((await environment.models.service.downloads.run(job.id)).state).toBe("installed");
    environment.change((configuration) => { configuration.bindings.transcription = { kind: "local", installationId: job.installationId }; });
    const input = { data: await readFile(fixturePath!), mime: "audio/wav", name: "jfk.wav", language: "en", segmentId: randomUUID(),
      who: "Computer fixture", time: "00:01" };
    const first = await audio.transcribe(environment.owner, environment.session.id, input, new AbortController().signal, async () => true);
    expect(first.text.toLowerCase()).toContain("country");
    const replay = await audio.transcribe(environment.owner, environment.session.id, input, new AbortController().signal, async () => true);
    expect(replay).toEqual(first);
    const entries = await environment.sessions.entries(environment.owner, environment.session.id, "transcripts", { limit: 10 });
    expect(entries).toHaveLength(1); expect(entries[0]!.data.text.toLowerCase()).toContain("country");
    expect(entries[0]!.data.who).toBe("Computer fixture");
    const snapshot = environment.connection.client.query<{ snapshot: string }, []>("SELECT snapshot FROM next_operations WHERE kind='transcription'").get();
    const saved = JSON.parse(snapshot!.snapshot) as { version: number; capabilities: { transcription: { kind: string } } };
    expect(saved.version).toBe(2); expect(saved.capabilities.transcription.kind).toBe("local");
    expect(environment.requests).toHaveLength(0);
    evidence.status = "passed"; evidence.persistedSegments = 1; evidence.apiProviderRequests = 0; evidence.transcript = first.text;
    evidence.limitations = ["Service integration with real inference; UI and native loopback are separate tests", "Single English fixture, not a PT/ES quality benchmark"];
  } catch (error) { evidence.status = "failed"; evidence.error = error instanceof Error ? error.message : "unknown"; throw error; }
  finally {
    await audio.close(); await environment.close();
    if (process.env.ORVUNIA_TEST_HISTORY_REPORT) await writeFile(process.env.ORVUNIA_TEST_HISTORY_REPORT, JSON.stringify(evidence, null, 2));
  }
}, 180_000);
