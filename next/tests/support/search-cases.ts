import { expect, test } from "bun:test";
import type { SessionFixture } from "./session-environment.ts";
import { sessionEnvironment } from "./session-environment.ts";
import type { SessionIndexRepository } from "../../packages/search/projection.ts";
import { sessionIndex } from "../../packages/search/service.ts";

export function searchCases(
  name: string,
  fixture: () => Promise<
    Awaited<ReturnType<SessionFixture>> & {
      indexRepository: SessionIndexRepository;
    }
  >,
) {
  test(`${name}: search folds accents in titles, transcripts and answers while keeping wildcard text literal and owners isolated`, async () => {
    const dependencies = await fixture();
    const { owner, service, repository } = await sessionEnvironment(
      async () => dependencies,
    );
    const index = sessionIndex(dependencies.indexRepository);
    const title = await service.create(owner, {
      mode: "technical",
      title: "Reunião técnica",
    });
    const transcript = await service.create(owner, {
      mode: "recruiter",
      title: "Conversation",
    });
    await service.transcript(owner, transcript.id, {
      text: "Comunicação e análise",
      who: "Speaker",
      time: "00:01",
      source: "manual",
    });
    const answer = await service.create(owner, {
        mode: "technical",
        title: "Answer",
      }),
      responseId = crypto.randomUUID();
    await repository.change(owner, answer.id, (current) => ({
      next: current,
      append: {
        id: responseId,
        conversationId: answer.id,
        kind: "responses",
        segmentId: null,
        data: {
          id: responseId,
          text: "Otimização de código, 100%_literal",
          action: "assist",
          mode: "technical",
          model: "synthetic",
          date: answer.createdAt,
        },
      },
    }));
    const find = (search: string, workspaceId = owner) =>
      index.page(workspaceId, { search, limit: 100 });
    expect((await find("REUNIAO")).items.map((item) => item.id)).toEqual([
      title.id,
    ]);
    expect((await find("comunicacao")).items.map((item) => item.id)).toEqual([
      transcript.id,
    ]);
    expect((await find("otimizacao")).items.map((item) => item.id)).toEqual([
      answer.id,
    ]);
    expect((await find("%_")).items.map((item) => item.id)).toEqual([
      answer.id,
    ]);
    expect((await find("otimizacao", crypto.randomUUID())).items).toEqual([]);
    await service.patch(owner, title.id, { title: "Arquitetura" });
    expect((await find("reuniao")).items).toEqual([]);
    expect((await find("arquitetura")).items[0]?.indexOnly).toBe(true);
    await service.clear(owner, transcript.id, "transcripts");
    expect((await find("comunicacao")).items).toEqual([]);
  });
  test(`${name}: index cursors retain stable ordering after anchor deletion and reject another owner or search`, async () => {
    const dependencies = await fixture();
    const { owner, service } = await sessionEnvironment(
      async () => dependencies,
    );
    const index = sessionIndex(dependencies.indexRepository);
    for (let number = 0; number < 5; number++)
      await service.create(owner, {
        mode: "technical",
        title: `Session ${number}`,
      });
    const all = await index.page(owner, { search: "", limit: 100 });
    const first = await index.page(owner, { search: "", limit: 2 });
    expect(first.before).not.toBeNull();
    const last = first.items.at(-1);
    if (!last || !first.before) throw Error("Cursor expected");
    await service.remove(owner, last.id);
    const second = await index.page(owner, {
      search: "",
      limit: 2,
      before: first.before,
    });
    expect(second.items.map((item) => item.id)).toEqual(
      all.items.slice(2, 4).map((item) => item.id),
    );
    await expect(
      index.page(crypto.randomUUID(), {
        search: "",
        limit: 2,
        before: first.before,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      index.page(owner, {
        search: "Different",
        limit: 2,
        before: first.before,
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
}
