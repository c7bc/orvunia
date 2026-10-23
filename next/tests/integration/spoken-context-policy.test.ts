import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { globalSystemPrompt } from "../../packages/prompts/global.ts";

test("generation receives immutable noisy wording and evidence in PT/EN/ES through one controlled provider call", async () => {
  const environment = await capabilityEnvironment();
  try {
    for (const [locale, question] of [
      ["pt-BR", "Sim. Como eu usaria post gré SQL, sem trocar Redis 7, com timeout de 25 ms, não 250 ms?"],
      ["en", "Audio check. How would I use PostgreSQL 16, not MySQL 8, with a limit of 25 ms?"],
      ["es", "Sí. ¿Cómo usaría PostgreSQL 16 sin cambiar Redis 7, con 25 ms y no 250 ms?"],
    ] as const) {
      const id = crypto.randomUUID();
      await environment.sessions.change(environment.owner, environment.session.id, session => ({ next: session,
        append: { id, conversationId: session.id, kind: "transcripts", segmentId: null,
          data: { id, text: question, who: "Interviewer", time: "00:01", source: "sample" } } }));
      await environment.workspace.update(environment.owner, workspace => { workspace.preferences.output = locale; });
      environment.input.requestId = crypto.randomUUID(); environment.input.question = question;
      environment.input.sourceTranscriptIds = [id];
      const before = environment.requests.length;
      const operation = await environment.prepare();
      const context = JSON.parse(operation.snapshot!.context) as { question: string; transcript: { id: string; text: string }[] };
      expect(context.question).toBe(question);
      expect(context.transcript.find(entry => entry.id === id)?.text).toBe(question);
      await environment.run(operation);
      expect(environment.requests.length - before).toBe(1);
      expect(environment.requests.at(-1)!.body.instructions).toContain(globalSystemPrompt("en"));
      expect((await environment.sessions.entry(environment.owner, environment.session.id, id, "transcripts"))?.data.text).toBe(question);
    }
  } finally { await environment.close(); }
});

test("explicit calibration analysis remains an ordinary request without sentinel or classifier round trips", async () => {
  const environment = await capabilityEnvironment();
  try {
    environment.input.question = 'Analise a calibração escrita "teste de áudio, um dois três" e explique os limites de avaliá-la sem o áudio.';
    const visible = (await environment.workspace.find(environment.owner)).modes.find(mode => mode.id === "technical")!.systemPrompt!;
    const operation = await environment.prepare();
    await environment.run(operation);
    expect(environment.requests).toHaveLength(1);
    expect(visible).toContain("an explicit request to read, analyze or improve a calibration passage, still deserves an answer");
    expect(visible).toContain("Text alone does not prove microphone operation or audio quality");
    expect(operation.snapshot!.instructions).toContain(visible);
    expect(environment.requests[0]!.body.instructions).toContain(visible);
    expect(JSON.parse(operation.snapshot!.context).question).toBe(environment.input.question);
  } finally { await environment.close(); }
});
