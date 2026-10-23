import type {
  PanelSession,
  PanelMode,
  PanelTemplate,
  PanelResponse,
  PanelPager,
  ModeBase,
} from "./data.js";
import type { AudioPhase } from "../audio-status/domain.js";
import type { DesktopDistribution } from "../platform/distribution.js";
type DesktopSettings = Partial<
  Record<
    | "protected"
    | "ambientChat"
    | "systemAudio"
    | "autoListen"
    | "transcribeMicrophone"
    | "realtime"
    | "autoScreen"
    | "autoAnswer"
    | "noFocus"
    | "clickthrough"
    | "launchAtLogin",
    boolean
  >
> & {
  theme?: string;
  opacity?: number;
  answerPauseSeconds?: number;
  shortcuts: Record<string, string | undefined>;
};
export type PanelState = {
  audioProgress?: ReadonlyMap<string, AudioPhase>;
  page: string;
  settingsTab: string;
  desktop: {
    distribution?: DesktopDistribution;
    native: boolean;
    version?: string;
    failedShortcuts: string[];
    settings: DesktopSettings;
  };
  sessions: PanelSession[];
  current?: PanelSession | null;
  agenda: { title: string; date: string; mode: string }[];
  modes: PanelMode[];
  modeTemplates: PanelTemplate[];
  modeEditor: string;
  modeCatalog?: boolean;
  editedMode?: PanelMode | null;
  modeDraft?: { systemPrompt?: string; instructions?: string } | null | undefined;
  selectedMode: string;
  noteSections: { title: string; instructions: string }[];
  library: { prompts: { id: string; title: string; mode: ModeBase }[] };
  actions: Record<ModeBase, [string, string, string][]>;
  prefs: { output: string; audio: string; code: string };
  profile?: { name?: string; role?: string; experience?: string } | null;
  health?: unknown;
  uiLocale?: string;
  accountOpen?: boolean;
  accountName?: string;
  accountEmail?: string;
  accountLocation?: string;
  isCloud?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  historyMenuId?: string | null;
  historyMenuAbove?: boolean;
  sessionIndexBefore?: string | null;
  historyPager?: PanelPager;
  responseWindowSize?: number;
  search?: string;
  detailTab?: string;
  detailDate?(value: string): string;
  hasActiveSession?: boolean;
  busy?: boolean;
  answerSessionId?: string | null | undefined;
  answerPhase?: string;
  liveText?: string;
  reviewChatDraft?: string;
  reviewChatOpen?: boolean;
  releaseVersion?: string;
  releaseDismissed?: boolean;
  activeVoiceActivity?: {
    sessionId: string;
    me?: boolean;
    them?: boolean;
  } | null;
  liveTranscript?: {
    sessionId: string;
    status: string;
    role: string;
    relativeMs: number;
    text: string;
  } | null;
  meLabel?: string;
  themLabel?: string;
  esc(value: unknown): string;
  icon(name: string | undefined, size?: number): string;
  ib(icon: string, action: string, label: string): string;
  button(label: string, action: string, style?: string, icon?: string): string;
  toggle(name: string, active: boolean | undefined): string;
  translate(value: string): string;
  markdown(value: string): string;
  actionTitle(value: string, mode?: ModeBase): string;
  date(value: string): string;
  time(seconds: number): string;
  duration(): number;
  modeName(id: string): string;
  agendaView(): string;
  profileForm(editing: boolean): string;
  settingsContent(): string;
  codingAttemptView?(): string;
  codingResponseActions?(response: PanelResponse): string;
  renderAccount?(section: string): string;
  renderBillingSettings?(): string;
  renderCalendarSettings?(): string;
  renderCalendarUpcoming?(): string;
  renderGazeSettings?(): string;
  renderModeRepository?(modeId: string): string;
  renderProviderSettings?(): string;
};
