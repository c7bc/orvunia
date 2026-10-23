import type {
  SessionPatch,
  SessionRecord,
  ModeSnapshot,
  Transcript,
  HistoryKind,
} from "./domain.ts";
import { SessionError } from "./domain.ts";
import type { SessionRepository } from "./repository.ts";

type Dependencies = {
  repository: SessionRepository;
  mode(workspaceId: string, id: string): Promise<ModeSnapshot | null>;
  identifier(): string;
  clock(): Date;
};
export function sessions({
  repository,
  mode,
  identifier,
  clock,
}: Dependencies) {
  async function find(workspaceId: string, id: string) {
    const current = await repository.find(workspaceId, id);
    if (!current) throw new SessionError("conversation_not_found");
    return current;
  }
  async function snapshot(
    workspaceId: string,
    base: SessionRecord["mode"],
    id?: string,
  ) {
    if (!id) return null;
    const selected = await mode(workspaceId, id);
    if (!selected) throw new SessionError("mode_not_found");
    if (selected.base !== base) throw new SessionError("invalid_input");
    return structuredClone(selected);
  }
  return {
    find,
    list: repository.list.bind(repository),
    async create(
      workspaceId: string,
      input: { title: string; mode: SessionRecord["mode"]; modeId?: string },
    ) {
      return repository.create({
        id: identifier(),
        workspaceId,
        title: input.title,
        mode: input.mode,
        state: "active",
        createdAt: clock().toISOString(),
        elapsed: 0,
        question: "",
        modeSnapshot: await snapshot(workspaceId, input.mode, input.modeId),
        historyGeneration: 0,
        revision: 0,
      });
    },
    async patch(
      workspaceId: string,
      id: string,
      input: SessionPatch & { modeId?: string },
    ) {
      await find(workspaceId, id);
      const selected = input.modeId
        ? await mode(workspaceId, input.modeId)
        : undefined;
      if (input.modeId && !selected) throw new SessionError("mode_not_found");
      const { modeId: _modeId, ...patch } = input;
      if (selected && !patch.mode) patch.mode = selected.base;
      return (
        await repository.change(workspaceId, id, (record) => {
          if (
            record.state === "ended" &&
            patch.state &&
            patch.state !== "ended"
          )
            throw new SessionError("conversation_ended");
          if (selected && selected.base !== (patch.mode ?? record.mode))
            throw new SessionError("invalid_input");
          return {
            next: {
              ...record,
              ...patch,
              ...(selected !== undefined ? { modeSnapshot: selected } : {}),
            },
          };
        })
      ).session;
    },
    resume: repository.resume.bind(repository),
    async remove(workspaceId: string, id: string) {
      if (!(await repository.remove(workspaceId, id)))
        throw new SessionError("conversation_not_found");
      return { ok: true };
    },
    async transcript(
      workspaceId: string,
      id: string,
      input: Omit<Transcript, "id">,
    ) {
      const transcript = { ...input, id: identifier() };
      const result = await repository.change(workspaceId, id, (record) => {
        if (record.state !== "active")
          throw new SessionError("conversation_ended");
        return {
          next: record,
          append: {
            id: transcript.id,
            conversationId: id,
            kind: "transcripts",
            segmentId: input.segmentId ?? null,
            data: transcript,
          },
        };
      });
      if (!result.appended || result.appended.kind !== "transcripts")
        throw Error("Transcript was not persisted");
      return result.appended.data;
    },
    async clear(workspaceId: string, id: string, kind: HistoryKind) {
      return (
        await repository.change(workspaceId, id, (record) => {
          if (record.state !== "active")
            throw new SessionError("conversation_ended");
          return {
            next: {
              ...record,
              historyGeneration: record.historyGeneration + 1,
            },
            clear: kind,
          };
        })
      ).session;
    },
  };
}
export type SessionService = ReturnType<typeof sessions>;
