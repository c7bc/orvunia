import { ConversationError } from "./domain.ts";
import type { Notes, NotesUpdate } from "./domain.ts";

export function updatedNotes(
  current: Notes,
  input: NotesUpdate,
  now: string,
): Notes {
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    input.text.length > 100_000
  ) {
    throw new ConversationError("invalid_input");
  }
  if (current.text === input.text) return current;
  if (current.revision !== input.revision)
    throw new ConversationError("notes_conflict", current);
  if (current.revision === Number.MAX_SAFE_INTEGER)
    throw new ConversationError("invalid_input");
  return { text: input.text, revision: current.revision + 1, updatedAt: now };
}
