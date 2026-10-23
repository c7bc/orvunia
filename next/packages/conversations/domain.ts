export type ConversationMode = "recruiter" | "technical";
export type ConversationState = "active" | "paused" | "ended";
export type Conversation = {
  id: string;
  workspaceId: string;
  title: string;
  mode: ConversationMode;
  state: ConversationState;
  createdAt: string;
};
export type Notes = {
  text: string;
  revision: number;
  updatedAt: string | null;
};
export type NewConversation = { title: string; mode: ConversationMode };
export type SavedNotes = Notes & { session: string };
export type NotesUpdate = { text: string; revision: number };

export class ConversationError extends Error {
  constructor(
    readonly code:
      | "conversation_not_found"
      | "notes_conflict"
      | "conversation_ended"
      | "invalid_input",
    readonly current?: Notes,
  ) {
    super(code);
  }
}
