import { sessionGuardCases } from "./session-guards.ts";
import { expect, test } from "bun:test";
import { modes } from "../../packages/workspaces/modes.ts";
import { sessionEnvironment } from "./session-environment.ts";
import type { SessionFixture } from "./session-environment.ts";
import { historyCases } from "./history-cases.ts";
export function sessionCases(name: string, fixture: SessionFixture) {
  const environment = () => sessionEnvironment(fixture);
  historyCases(name, environment);
  sessionGuardCases(name, environment);
  test(`${name}: mode snapshots survive edits and metadata patches cannot reopen ended sessions`, async () => {
    const { owner, workspace, service } = await environment();
    const modeService = modes(
      workspace,
      () => crypto.randomUUID(),
      () => new Date(),
    );
    const mode = (
      await modeService.create(owner, { templateId: "technical-interview" })
    ).mode;
    const created = await service.create(owner, {
      title: "Technical",
      mode: "technical",
      modeId: mode.id,
    });
    await modeService.edit(owner, mode.id, {
      instructions: "Changed after creation",
    });
    expect(
      (await service.find(owner, created.id)).modeSnapshot?.instructions,
    ).toBe(mode.instructions);
    const changed = await service.patch(owner, created.id, {
      modeId: "recruiter",
      elapsed: 123,
    });
    expect(changed.mode).toBe("recruiter");
    expect(changed.elapsed).toBe(123);
    await service.patch(owner, created.id, { state: "ended" });
    await expect(
      service.patch(owner, created.id, { state: "paused" }),
    ).rejects.toMatchObject({ code: "conversation_ended" });
    await expect(
      service.find(crypto.randomUUID(), created.id),
    ).rejects.toMatchObject({ code: "conversation_not_found" });
  });
  test(`${name}: transcript segments deduplicate and stale history cursors fail after deletion`, async () => {
    const { owner, service, history } = await environment();
    const session = await service.create(owner, {
      title: "History",
      mode: "technical",
    });
    const segmentId = crypto.randomUUID();
    const transcript = {
      text: "Original",
      who: "Interviewer",
      time: "00:01",
      source: "audio" as const,
      segmentId,
    };
    const first = await service.transcript(owner, session.id, transcript);
    const repeated = await service.transcript(owner, session.id, {
      ...transcript,
      text: "Changed retry",
    });
    expect(repeated).toEqual(first);
    for (let index = 1; index < 105; index++)
      await service.transcript(owner, session.id, {
        text: `Statement ${index}`,
        who: "Interviewer",
        time: "00:02",
        source: "manual",
      });
    const recent = await history.page(
      owner,
      session.id,
      "transcripts",
      undefined,
      20,
    );
    expect(recent.total).toBe(105);
    expect(recent.items).toHaveLength(20);
    const older = await history.page(
      owner,
      session.id,
      "transcripts",
      recent.before ?? undefined,
      100,
    );
    expect(older.items).toHaveLength(85);
    expect(older.items[0]?.id).toBe(first.id);
    expect(await history.all(owner, session.id, "transcripts")).toHaveLength(
      105,
    );
    await service.clear(owner, session.id, "transcripts");
    await expect(
      history.page(
        owner,
        session.id,
        "transcripts",
        recent.before ?? undefined,
      ),
    ).rejects.toMatchObject({ code: "history_changed" });
    expect((await history.view(owner, session.id)).transcripts).toHaveLength(0);
  });
  test(`${name}: concurrent resume selects one active session and history remains owner-scoped`, async () => {
    const { owner, service, repository } = await environment();
    const first = await service.create(owner, {
      title: "First",
      mode: "recruiter",
    });
    const second = await service.create(owner, {
      title: "Second",
      mode: "technical",
    });
    await service.patch(owner, first.id, { state: "ended" });
    await service.patch(owner, second.id, { state: "ended" });
    const resumed = await Promise.allSettled([
      service.resume(owner, first.id),
      service.resume(owner, second.id),
    ]);
    expect(
      resumed.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const active = (await service.list(owner, 100)).find(
      (session) => session.state === "active",
    );
    expect(active).toBeDefined();
    if (!active) throw Error("Active session missing");
    await service.transcript(owner, active.id, {
      text: "Private",
      who: "Me",
      time: "00:01",
      source: "manual",
    });
    expect(
      await repository.entries(crypto.randomUUID(), active.id, "transcripts", {
        limit: 100,
      }),
    ).toEqual([]);
    await service.remove(owner, active.id);
    expect(await repository.counts(owner, active.id)).toEqual({
      transcripts: 0,
      responses: 0,
      captures: 0,
    });
  });
}
