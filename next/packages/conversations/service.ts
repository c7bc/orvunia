import { ConversationError } from "./domain.ts";
import type { NewConversation, NotesUpdate } from "./domain.ts";
import type { ConversationRepository } from "./repository.ts";

export function conversations(
  repository: ConversationRepository,
  identity: () => string,
  now: () => Date,
) {
  async function requireConversation(workspaceId: string, id: string) {
    const conversation = await repository.find(workspaceId, id);
    if (!conversation) throw new ConversationError("conversation_not_found");
    return conversation;
  }
  return {
    create(workspaceId: string, input: NewConversation) {
      return repository.insert({
        ...input,
        workspaceId,
        id: identity(),
        state: "active",
        createdAt: now().toISOString(),
      });
    },
    find: requireConversation,
    list: repository.list.bind(repository),
    exportNotes: repository.exportNotes.bind(repository),
    async end(workspaceId: string, id: string) {
      const ended = await repository.end(workspaceId, id);
      if (!ended) throw new ConversationError("conversation_not_found");
      return ended;
    },
    async notes(workspaceId: string, id: string) {
      await requireConversation(workspaceId, id);
      return repository.notes(workspaceId, id);
    },
    async updateNotes(workspaceId: string, id: string, input: NotesUpdate) {
      await requireConversation(workspaceId, id);
      return repository.updateNotes(
        workspaceId,
        id,
        input,
        now().toISOString(),
      );
    },
  };
}
export type ConversationService = ReturnType<typeof conversations>;
