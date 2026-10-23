import { SessionError } from "./domain.ts";
import type { HistoryKind, SessionRecord, StoredEntry } from "./domain.ts";
import type { SessionRepository } from "./repository.ts";
import type { SessionService } from "./service.ts";
import { historyCursor, historyPosition } from "./cursor.ts";

export function sessionHistory(
  repository: SessionRepository,
  sessions: SessionService,
) {
  async function unchanged(workspaceId: string, session: SessionRecord) {
    const current = await sessions.find(workspaceId, session.id);
    if (current.historyGeneration !== session.historyGeneration)
      throw new SessionError("history_changed");
  }
  async function page(
    workspaceId: string,
    id: string,
    kind: HistoryKind,
    before?: string,
    limit = 20,
  ) {
    const session = await sessions.find(workspaceId, id);
    const position = historyPosition(before, session, kind);
    const rows = await repository.entries(workspaceId, id, kind, {
      limit: limit + 1,
      ...(position !== undefined ? { before: position } : {}),
    });
    const more = rows.length > limit;
    if (more) rows.shift();
    const counts = await repository.counts(workspaceId, id);
    const first = rows[0];
    await unchanged(workspaceId, session);
    return {
      items: rows.map((row) => ({ ...row.data, _position: row.position })),
      total: counts[kind],
      generation: session.historyGeneration,
      before:
        more && first ? historyCursor(session, kind, first.position) : null,
    };
  }
  async function all(workspaceId: string, id: string, kind: HistoryKind) {
    const session = await sessions.find(workspaceId, id);
    const result: StoredEntry[] = [];
    let before: number | undefined;
    while (true) {
      const rows = await repository.entries(workspaceId, id, kind, {
        limit: 100,
        ...(before !== undefined ? { before } : {}),
      });
      result.unshift(...rows);
      if (rows.length < 100) {
        await unchanged(workspaceId, session);
        return result.map((row) => row.data);
      }
      before = rows[0]?.position;
    }
  }
  async function full(workspaceId: string, id: string) {
    const session = await sessions.find(workspaceId, id);
    const [transcripts, responses, captures] = await Promise.all(
      (["transcripts", "responses", "captures"] as const).map((kind) =>
        all(workspaceId, id, kind),
      ),
    );
    await unchanged(workspaceId, session);
    return {
      ...publicSession(session),
      transcripts: transcripts ?? [],
      responses: responses ?? [],
      captures: captures ?? [],
    };
  }
  async function view(workspaceId: string, id: string) {
    const session = await sessions.find(workspaceId, id);
    const [transcripts, responses, captures] = await Promise.all([
      page(workspaceId, id, "transcripts", undefined, 80),
      page(workspaceId, id, "responses", undefined, 20),
      page(workspaceId, id, "captures", undefined, 30),
    ]);
    const info = (value: typeof transcripts) => ({
      total: value.total,
      before: value.before,
      generation: value.generation,
    });
    const latestSummary = await repository.latestSummary(workspaceId, id);
    await unchanged(workspaceId, session);
    return {
      ...publicSession(session),
      generation: session.historyGeneration,
      transcripts: transcripts.items,
      responses: responses.items,
      captures: captures.items,
      latestSummary,
      history: {
        generation: session.historyGeneration,
        transcripts: info(transcripts),
        responses: info(responses),
        captures: info(captures),
      },
    };
  }
  return { page, all, full, view };
}
export function publicSession(session: SessionRecord) {
  return {
    id: session.id,
    owner: session.workspaceId,
    mode: session.mode,
    title: session.title,
    state: session.state,
    elapsed: session.elapsed,
    date: session.createdAt,
    question: session.question,
    ...(session.modeSnapshot
      ? { modeId: session.modeSnapshot.id, modeSnapshot: session.modeSnapshot }
      : {}),
  };
}
export type SessionHistory = ReturnType<typeof sessionHistory>;
