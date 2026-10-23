import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { recordedTranscription } from "../../packages/transcription/service.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";

test("transcription acquisition failure can retry the same segment after resources recover", async () => {
  const environment = await capabilityEnvironment();
  let blocked = true;
  const audio = recordedTranscription({ ...environment.dependencies, local: true,
    capabilities: { ...environment.router, async acquireTranscription(plan, signal) {
      if (blocked) throw new LocalModelError("hardware_incompatible", 409);
      return environment.router.acquireTranscription(plan, signal);
    } },
  });
  try {
    const input = { data: Uint8Array.from([1]), mime: "audio/wav", name: "synthetic.wav", language: "en",
      segmentId: crypto.randomUUID(), who: "Synthetic input", time: "00:01" };
    const run = () => audio.transcribe(environment.owner, environment.session.id, input, new AbortController().signal, async () => true);
    await expect(run()).rejects.toMatchObject({ code: "hardware_incompatible", status: 409 });
    expect(environment.requests).toHaveLength(0);
    expect(environment.connection.client.query("SELECT state FROM next_usage").all()).toEqual([{ state: "released" }]);
    expect(environment.connection.client.query("SELECT state FROM next_operations WHERE kind='transcription'").get()).toEqual({ state: "failed" });
    blocked = false;
    environment.upstream(async () => Response.json({ text: "Synthetic recognised speech" }));
    expect((await run()).text).toBe("Synthetic recognised speech");
    expect((await run()).text).toBe("Synthetic recognised speech");
    expect(environment.requests).toHaveLength(1);
    expect(await environment.sessions.entries(environment.owner, environment.session.id, "transcripts", { limit: 10 })).toHaveLength(1);
  } finally { await audio.close(); await environment.close(); }
});
