import type { PanelSession, PanelResponse, PanelMode } from "../panel/data.js";
import type {
  AnswerAttempt,
  AnswerNote,
  AnswerRequest,
} from "../answers/domain.js";
import type { CompatibilitySettings } from "../panel/compatibility-types.js";
export interface CommandResponse extends PanelResponse {
  captureIds?: string[];
}
export interface CommandSession extends PanelSession {
  mode: "recruiter" | "technical";
  responses: CommandResponse[];
}
export interface CommandSettings extends CompatibilitySettings {
  autoAnswer?: boolean;
  answerPauseSeconds?: number;
  microphone?: string;
  systemAudioDevice?: string;
  [key: string]: unknown;
}
export interface CommandDesktop {
  settings: CommandSettings;
  failedShortcuts: string[];
  overlayVisible?: boolean;
}
export type ModeTemplate = Pick<PanelMode, "id" | "name" | "base"> &
  Partial<PanelMode>;
export type ModeResult = {
  modes: PanelMode[];
  activeId: string;
  mode?: PanelMode;
  templates?: ModeTemplate[];
};
export type CommandPrompt = {
  id: string;
  title: string;
  instructions: string;
  mode: "recruiter" | "technical";
};
export type CommandDocument = { id: string; name: string; text: string };
export type CommandAgenda = {
  id: string;
  title: string;
  date: string;
  mode: string;
  calendarUid?: string;
};
export type CommandAttempt = Pick<
  AnswerAttempt,
  "text" | "expired" | "input" | "review"
> & { request?: AnswerRequest; cancelled?: boolean; message?: string };
export interface CommandState {
  view: string;
  page: string;
  settingsTab: string;
  tab: string;
  detailTab: string;
  selectedMode: string;
  modeEditor: string;
  reviewChatSessionId: string | null;
  current: CommandSession | null;
  sessions: CommandSession[];
  profile: Record<string, string | undefined> | null;
  prefs: {
    code: string;
    output: string;
    audio: string;
    [key: string]: string | Record<string, string> | undefined;
  };
  desktop: CommandDesktop;
  busy: boolean;
  draft: string;
  search: string;
  overlayMore: boolean;
  chatCollapsed: boolean;
  historyMenuAbove: boolean;
  historyMenuId: string | null;
  accountOpen: boolean;
  modeCatalog: boolean;
  controller: AbortController | null;
  recapGeneration: AnswerNote | null;
  generatedRecapFallback: { text: string } | null;
  library: { prompts: CommandPrompt[]; documents: CommandDocument[] };
  agenda: CommandAgenda[];
  modes: PanelMode[];
  releaseVersion: string;
  source: { id: string } | null;
  activeAnswerRequest: AnswerRequest | null;
  sessionSearchTimer: number | null;
  sessionSearchEpoch: number;
  sessionSearchQuery: string;
  sessionSearchBefore: string | null;
}
export function requireCommandSession(state: CommandState): CommandSession {
  if (!state.current) throw Error("Reabra a sessão antes de continuar.");
  return state.current;
}
