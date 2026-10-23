import type { PanelState } from "../panel/state.js";
import type { PanelMode, PanelSession } from "../panel/data.js";
import type { OverlayState } from "../overlay/state.js";
import type { createActivityPresentation } from "./activity.js";

export type NoteSection = { title: string; instructions: string };
export type ModeDraft = { notes?: string; systemPrompt?: string; instructions?: string };
export type PanelValues = Required<
  Pick<
    PanelState,
    | "profile"
    | "prefs"
    | "library"
    | "health"
    | "desktop"
    | "page"
    | "settingsTab"
    | "accountOpen"
    | "selectedMode"
    | "modeEditor"
    | "modes"
    | "modeTemplates"
    | "detailTab"
    | "historyMenuId"
    | "historyMenuAbove"
    | "modeCatalog"
    | "releaseVersion"
    | "sessionIndexBefore"
    | "agenda"
    | "search"
  >
> & {
  native: boolean;
  current: PanelSession | null;
  sessions: PanelSession[];
  navigationIndex: number;
  navigationLength: number;
  activeAnswerRequest: OverlayState["activeAnswerRequest"];
  reviewChatSessionId: string | null;
  answerPhase: string;
  busy: boolean;
  liveText: string;
  liveQuestion: string;
};
type Renderers = Required<
  Pick<
    PanelState,
    | "icon"
    | "esc"
    | "ib"
    | "button"
    | "toggle"
    | "markdown"
    | "actionTitle"
    | "date"
    | "time"
    | "duration"
    | "modeName"
    | "agendaView"
    | "profileForm"
    | "settingsContent"
    | "codingAttemptView"
    | "codingResponseActions"
    | "historyPager"
    | "actions"
  >
>;
export type PanelStatePorts = Renderers & {
  read(): PanelValues;
  modeBase: OverlayState["modeBase"];
  editedMode(): (PanelMode & { sections?: NoteSection[] }) | null;
  modeDraft(id: string): ModeDraft | undefined;
  sections(template: string): NoteSection[];
  serializeSections(sections: NoteSection[]): string;
  cloud(): boolean;
  locale(): string;
  translate(value: string): string;
  activity: ReturnType<typeof createActivityPresentation>["state"];
  detailDraft(id: string): string;
  formatActivity(value: string, locale: string): string;
  account(): { name?: string; email?: string } | null;
  accountMarkup(section: string): string | undefined;
  renderProviderSettings(): string;
  renderBillingSettings(): string;
  renderCalendarSettings(): string;
  renderCalendarUpcoming(): string;
  renderGazeSettings(): string;
  renderModeRepository?(modeId: string): string;
};
export type OverlayStatePorts = {
  read(): Omit<OverlayState, "coding">;
  coding(sessionId: string): OverlayState["coding"];
};
