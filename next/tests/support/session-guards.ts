import { expect, test } from "bun:test";
import { sessionHistory } from "../../packages/sessions/history.ts";
import type { SessionEnvironment } from "./session-environment.ts";
import { onboarding } from "../../packages/workspaces/onboarding.ts";
import { onboardingSchema } from "../../packages/contracts/onboarding.ts";

export function sessionGuardCases(
  name: string,
  environment: () => Promise<SessionEnvironment>,
) {
  test(`${name}: onboarding survives independent preferences and mode changes without crossing owners`, async () => {
    const { owner, workspace } = await environment();
    const service = onboarding(workspace),
      initial = await workspace.find(owner);
    const state = onboardingSchema.parse({
      persona: "professional",
      goal: "Systems",
      completed: true,
    });
    await Promise.all([
      service.save(owner, state),
      workspace.savePreferences(owner, {
        ...initial.preferences,
        output: "en",
      }),
    ]);
    expect(await service.find(owner)).toEqual(state);
    expect((await workspace.find(owner)).preferences.output).toBe("en");
    expect((await service.find(crypto.randomUUID())).completed).toBe(false);
  });
  test(`${name}: changes cannot move history or session ownership and a failed mutation preserves metadata`, async () => {
    const { owner, service, repository } = await environment();
    const session = await service.create(owner, {
      title: "Original",
      mode: "technical",
    });
    await expect(
      repository.change(owner, session.id, (current) => ({
        next: { ...current, workspaceId: crypto.randomUUID() },
      })),
    ).rejects.toMatchObject({ code: "request_conflict" });
    await expect(
      repository.change(owner, session.id, (current) => ({
        next: { ...current, title: "Invalid" },
        append: {
          id: crypto.randomUUID(),
          conversationId: crypto.randomUUID(),
          kind: "transcripts",
          segmentId: null,
          data: {
            id: crypto.randomUUID(),
            text: "Text",
            source: "manual",
            who: "Speaker",
            time: "00:00",
          },
        },
      })),
    ).rejects.toMatchObject({ code: "request_conflict" });
    expect((await repository.find(owner, session.id))?.title).toBe("Original");
    expect((await repository.counts(owner, session.id)).transcripts).toBe(0);
  });
  test(`${name}: a history clear during projection cannot return a mixture of generations`, async () => {
    const { owner, service, repository } = await environment();
    const session = await service.create(owner, {
      title: "Concurrent clear",
      mode: "technical",
    });
    await service.transcript(owner, session.id, {
      text: "Old",
      time: "00:01",
      source: "manual",
      who: "Speaker",
    });
    const entries = repository.entries.bind(repository);
    let cleared = false;
    const original = repository.entries;
    repository.entries = async (...args) => {
      const rows = await entries(...args);
      if (!cleared) {
        cleared = true;
        await service.clear(owner, session.id, "transcripts");
      }
      return rows;
    };
    try {
      await expect(
        sessionHistory(repository, service).full(owner, session.id),
      ).rejects.toMatchObject({ code: "history_changed" });
    } finally {
      repository.entries = original;
    }
  });
}
