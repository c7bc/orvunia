import { expect, test } from "bun:test";
import type { SessionEnvironment } from "./session-environment.ts";
export function historyCases(
  name: string,
  environment: () => Promise<SessionEnvironment>,
) {
  test(`${name}: windowed usage retains an older recap and failed writes roll back metadata`, async () => {
    const { owner, service, repository, history } = await environment();
    const session = await service.create(owner, {
      title: "Original",
      mode: "technical",
    });
    const recapId = crypto.randomUUID();
    for (let index = 0; index < 25; index++) {
      const identifier = index === 0 ? recapId : crypto.randomUUID();
      await repository.change(owner, session.id, (record) => ({
        next: record,
        append: {
          id: identifier,
          conversationId: session.id,
          kind: "responses",
          segmentId: null,
          data: {
            id: identifier,
            action: index === 0 ? "recap" : "assist",
            text: `Answer ${index}`,
            mode: "technical",
            model: "synthetic",
            date: session.createdAt,
          },
        },
      }));
    }
    expect((await history.view(owner, session.id)).latestSummary?.id).toBe(
      recapId,
    );
    const other = await service.create(owner, {
      title: "Other",
      mode: "technical",
    });
    await expect(
      repository.change(owner, other.id, (record) => ({
        next: { ...record, title: "Must roll back" },
        append: {
          id: recapId,
          conversationId: other.id,
          kind: "responses",
          segmentId: null,
          data: {
            id: recapId,
            action: "assist",
            text: "Collision",
            mode: "technical",
            model: "synthetic",
            date: session.createdAt,
          },
        },
      })),
    ).rejects.toBeDefined();
    expect((await service.find(owner, other.id)).title).toBe("Other");
  });
}
