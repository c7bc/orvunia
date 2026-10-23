export type ModeSnapshot = {
  id: string;
  name: string;
  base: "recruiter" | "technical";
  instructions: string;
  systemPrompt?: string;
  sections: { title: string; instructions: string }[];
  documents: { id: string; name: string; text: string; date: string }[];
  builtin: boolean;
  created: string;
  updated: string;
};
export type SessionRecord = {
  id: string;
  workspaceId: string;
  title: string;
  mode: "recruiter" | "technical";
  state: "active" | "paused" | "ended";
  createdAt: string;
  elapsed: number;
  question: string;
  modeSnapshot: ModeSnapshot | null;
  historyGeneration: number;
  revision: number;
};
export type Transcript = {
  id: string;
  text: string;
  who: string;
  time: string;
  source: "manual" | "audio" | "sample";
  segmentId?: string;
  utteranceId?: string;
};
export type LegacySegment = Transcript | { text: ""; empty: true };
export type Answer = {
  id: string;
  text: string;
  action: string;
  mode: string;
  model: string;
  date: string;
  question?: string;
  captureIds?: string[];
  sourceTranscriptIds?: string[];
};
export type Capture = { id: string; title: string; time: string; url: string };
export type HistoryItems = {
  transcripts: Transcript;
  responses: Answer;
  captures: Capture;
};
export type HistoryKind = keyof HistoryItems;
export type HistoryEntry = {
  [Kind in HistoryKind]: {
    id: string;
    conversationId: string;
    kind: Kind;
    segmentId: string | null;
    data: HistoryItems[Kind];
  };
}[HistoryKind];
export type StoredEntry = HistoryEntry & { position: number };
export type StoredEntryOf<Kind extends HistoryKind> = Extract<
  HistoryEntry,
  { kind: Kind }
> & { position: number };
export type SessionChange = {
  next: SessionRecord;
  append?: HistoryEntry;
  clear?: HistoryKind;
  remove?: string;
};
export type SessionPatch = Partial<
  Pick<SessionRecord, "title" | "mode" | "state" | "elapsed" | "question">
>;
export class SessionError extends Error {
  constructor(
    readonly code:
      | "conversation_not_found"
      | "conversation_ended"
      | "session_busy"
      | "mode_not_found"
      | "invalid_input"
      | "history_changed"
      | "request_conflict",
  ) {
    super(code);
  }
}
