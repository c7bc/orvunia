export type SavedNote = {
  text: string;
  revision: number;
  updatedAt: string | null;
};
export type NoteStatus =
  "loading" | "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict";
export type NoteState = SavedNote & {
  id: string;
  loaded: boolean;
  dirty: boolean;
  status: NoteStatus;
  error: string;
  conflict: SavedNote | null;
  loading: Promise<NoteState> | null;
  saving: Promise<void> | null;
  applying: Promise<void> | null;
  timer: number | null;
  savedTimer: number | null;
  edits: number;
};
export type GeneratedNote = Readonly<{
  id: string;
  text: string;
  revision: number;
  edits: number;
}>;
export type NoteRequest = (
  id: string,
  method: "GET" | "PATCH",
  body?: { text: string; revision: number },
) => Promise<SavedNote>;
export type NotesOptions = {
  request: NoteRequest;
  delay?: number;
  savedDuration?: number;
  onChange?(id: string, state: NoteState): void;
};
export type NotesContext = {
  request: NoteRequest;
  current(state: NoteState): boolean;
  get(id: string): NoteState;
  notify(state: NoteState): void;
  schedule(state: NoteState): void;
  saved(state: NoteState): void;
};
export function noteFailure(error: unknown) {
  const value = error && typeof error === "object" ? error : {};
  const current = "current" in value ? value.current : null;
  return {
    message:
      "message" in value
        ? String(value.message)
        : "Não foi possível salvar suas notas.",
    code: "code" in value ? String(value.code) : "",
    current: savedNote(current),
  };
}
export function savedNote(value: unknown): SavedNote | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("text" in value) ||
    typeof value.text !== "string" ||
    !("revision" in value) ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !("updatedAt" in value) ||
    (value.updatedAt !== null && typeof value.updatedAt !== "string")
  )
    return null;
  return {
    text: value.text,
    revision: value.revision,
    updatedAt: value.updatedAt,
  };
}
