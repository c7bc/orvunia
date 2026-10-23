import type { Conversation, Notes, NotesUpdate, SavedNotes } from "./domain.ts";

export interface ConversationRepository {
  insert(conversation: Conversation): Promise<Conversation>;
  find(workspaceId: string, id: string): Promise<Conversation | null>;
  list(
    workspaceId: string,
    limit: number,
    before?: string,
  ): Promise<Conversation[]>;
  end(workspaceId: string, id: string): Promise<Conversation | null>;
  notes(workspaceId: string, id: string): Promise<Notes>;
  exportNotes(workspaceId: string): Promise<SavedNotes[]>;
  updateNotes(
    workspaceId: string,
    id: string,
    update: NotesUpdate,
    now: string,
  ): Promise<Notes>;
}
