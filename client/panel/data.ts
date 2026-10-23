import type { HistoryItem, HistoryView } from "../history/view.js";
export type ModeBase = "recruiter" | "technical";
export type PanelResponse = HistoryItem & {
  action: string;
  text: string;
  question?: string;
  sourceTranscriptIds?: string[];
  mode?: ModeBase;
  model?: string;
};
export type PanelTranscript = HistoryItem & {
  utteranceId?: string;
  source?: string;
  text: string;
  who: string;
  time: string;
};
export type PanelCapture = HistoryItem & { url: string; title?: string };
export type PanelSession = Omit<
  HistoryView,
  "responses" | "transcripts" | "captures"
> & {
  title: string;
  date: string;
  state: string;
  elapsed: number;
  mode?: ModeBase;
  modeId?: string;
  notes?: string | null;
  latestSummary?: PanelResponse | null;
  responses: PanelResponse[];
  transcripts: PanelTranscript[];
  captures: PanelCapture[];
};
export type PanelMode = {
  id: string;
  name: string;
  base: ModeBase;
  builtin?: boolean;
  systemPrompt?: string;
  instructions?: string;
  description?: string;
  sections?: { title: string; instructions: string }[];
  documents: { id: string; name: string; text: string }[];
};
export type PanelTemplate = Pick<PanelMode, "id" | "name" | "base"> &
  Partial<PanelMode>;
export type DisplayPage<T> = {
  items: T[];
  key: string;
  hasOlder: boolean;
  hasNewer: boolean;
  newerCount: number;
};
export type PanelPager = {
  page(
    session: PanelSession,
    kind: "responses",
    options: { view: string; filter?(response: PanelResponse): boolean },
  ): DisplayPage<PanelResponse>;
  page(
    session: PanelSession,
    kind: "transcripts",
    options: { view: string },
  ): DisplayPage<PanelTranscript>;
  page(
    session: PanelSession,
    kind: "captures",
    options: { view: string },
  ): DisplayPage<PanelCapture>;
};
