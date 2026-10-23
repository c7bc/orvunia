import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";

async function linkedEnvironment() {
  const environment = await capabilityEnvironment(), id = crypto.randomUUID();
  await environment.sessions.change(environment.owner, environment.session.id, current => ({ next: current,
    append: { id, conversationId: current.id, kind: "transcripts", segmentId: null,
      data: { id, text: "Controlled source question", who: "Interviewer", time: "00:01", source: "audio" } } }));
  environment.input.sourceTranscriptIds = [id];
  return { ...environment, sourceId: id };
}

test("capability v2 answer retains original transcript links through durable history and replay", async () => {
  const environment = await linkedEnvironment();
  try {
    const operation = await environment.prepare();
    expect(operation.snapshot?.version).toBe(2);
    const result = await environment.run(operation);
    expect(result.sourceTranscriptIds).toEqual([environment.sourceId]);
    const history = await environment.sessions.entry(environment.owner, environment.session.id, result.id, "responses");
    expect(history?.data.sourceTranscriptIds).toEqual([environment.sourceId]);
    expect((await environment.run(await environment.prepare())).sourceTranscriptIds).toEqual([environment.sourceId]);
    expect(environment.requests).toHaveLength(1);
  } finally { await environment.close(); }
});

test("capability v2 rejects a deleted question before any independent vision or text invocation", async () => {
  const environment = await linkedEnvironment();
  try {
    await environment.imageService.upload(environment.owner, environment.session.id, {
      data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), mime: "image/png", title: "Synthetic image",
      time: "00:01", requestKey: crypto.randomUUID() });
    const operation = await environment.prepare();
    await environment.sessions.change(environment.owner, environment.session.id, current => ({ next: current, remove: environment.sourceId }));
    await expect(environment.run(operation)).rejects.toMatchObject({ code: "history_changed" });
    expect(environment.requests).toHaveLength(0);
  } finally { await environment.close(); }
});
