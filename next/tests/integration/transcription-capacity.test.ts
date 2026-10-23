import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { recordedTranscription } from "../../packages/transcription/service.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";

for (const code of ["runtime_busy", "runtime_not_loaded"] as const)
test(`${code} before a CLI starts releases the reservation and permits same-segment recovery`, async () => {
  const environment = await capabilityEnvironment();
  let busy = true, calls = 0;
  const service = recordedTranscription({ ...environment.dependencies, local: true,
    capabilities: { ...environment.router, async acquireTranscription() {
      return { provider: { async transcribe() { calls++; if (busy) throw new LocalModelError(code, 409);
        return "Recovered useful speech"; } }, async release() {} };
    } },
  });
  const input = { data: Uint8Array.from([1]), mime: "audio/wav", name: "synthetic.wav", language: "en",
    segmentId: crypto.randomUUID(), who: "Eu", time: "00:01" };
  const run = () => service.transcribe(environment.owner, environment.session.id, input,
    new AbortController().signal, async () => true);
  try {
    await expect(run()).rejects.toMatchObject({ code, status: 409 });
    expect(environment.connection.client.query("SELECT state FROM next_operations WHERE kind='transcription'").get())
      .toEqual({ state: "failed" });
    expect(environment.connection.client.query("SELECT state FROM next_usage").all()).toEqual([{ state: "released" }]);
    busy = false; expect((await run()).text).toBe("Recovered useful speech");
    expect((await run()).text).toBe("Recovered useful speech"); expect(calls).toBe(2);
    expect((await environment.sessions.counts(environment.owner, environment.session.id)).transcripts).toBe(1);
  } finally { await service.close(); await environment.close(); }
});
