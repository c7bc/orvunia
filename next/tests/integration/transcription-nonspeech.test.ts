import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { recordedTranscription } from "../../packages/transcription/service.ts";

const input = () => ({ data: Uint8Array.from([1]), mime: "audio/wav", name: "synthetic.wav", language: "pt",
  segmentId: crypto.randomUUID(), who: "Eu", time: "00:01" });

test("an acquired adapter marker becomes a completed empty receipt and releases its lease once", async () => {
  const environment = await capabilityEnvironment();
  let calls = 0, releases = 0;
  const dependencies = { ...environment.dependencies, local: true, capabilities: { ...environment.router,
    async acquireTranscription() { return { provider: { async transcribe() { calls++; return "[MÚSICA DE FUNDO]"; } },
      async release() { releases++; } }; } } };
  const service = recordedTranscription(dependencies), restarted = recordedTranscription(dependencies), audio = input();
  const run = (selected = service) => selected.transcribe(environment.owner, environment.session.id, audio,
    new AbortController().signal, async () => true);
  try {
    expect(await run()).toEqual({ text: "", empty: true });
    expect(await run(restarted)).toEqual({ text: "", empty: true });
    expect(calls).toBe(1); expect(releases).toBe(1); expect(environment.requests).toHaveLength(0);
    expect((await environment.sessions.counts(environment.owner, environment.session.id)).transcripts).toBe(0);
    expect(environment.connection.client.query("SELECT state FROM next_operations WHERE kind='transcription'").get())
      .toEqual({ state: "completed" });
  } finally { await service.close(); await restarted.close(); await environment.close(); }
});

test("historical completed marker receipts and history retain their original replay without another provider call", async () => {
  const environment = await capabilityEnvironment();
  const service = recordedTranscription({ ...environment.dependencies, local: true }), audio = input();
  const run = () => service.transcribe(environment.owner, environment.session.id, audio, new AbortController().signal, async () => true);
  environment.upstream(async () => Response.json({ text: "Historical synthetic speech" }));
  try {
    const previous = await run();
    const saved = environment.connection.client.query("SELECT id,result FROM next_operations WHERE kind='transcription'")
      .get() as { id: string; result: string };
    const historical = { ...JSON.parse(saved.result), text: "[MUSIC]" };
    environment.connection.client.query("UPDATE next_operations SET result=? WHERE id=?").run(JSON.stringify(historical), saved.id);
    const record = environment.connection.client.query("SELECT data FROM next_history WHERE kind='transcripts'").get() as { data: string };
    const data = { ...JSON.parse(record.data), text: "[MUSIC]" };
    environment.connection.client.query("UPDATE next_history SET data=? WHERE kind='transcripts'").run(JSON.stringify(data));
    expect(await run()).toEqual({ ...previous, text: "[MUSIC]" });
    expect(environment.requests).toHaveLength(1);
    expect(environment.connection.client.query("SELECT result FROM next_operations WHERE id=?").get(saved.id))
      .toEqual({ result: JSON.stringify(historical) });
    expect((await environment.sessions.entries(environment.owner, environment.session.id, "transcripts", { limit: 10 }))[0]?.data.text)
      .toBe("[MUSIC]");
  } finally { await service.close(); await environment.close(); }
});
