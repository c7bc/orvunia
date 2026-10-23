import type {
  ModeBase,
  PanelMode,
  PanelSession,
  PanelResponse,
  PanelPager,
} from "../panel/data.js";
import type { CodingState } from "../coding/domain.js";
import type { AudioPhase } from "../audio-status/domain.js";
import type { PartialTranscript } from "../application-render/activity.js";
export type OverlayState = {
  current: PanelSession | null;
  busy: boolean;
  activeAnswerRequest: { sessionId: string; sourceTranscriptIds?: string[] } | null;
  partialTranscripts?: ReadonlyMap<string, PartialTranscript>;
  translate?(value: string): string;
  tab: string;
  chatCollapsed: boolean;
  overlayMore: boolean;
  draft: string;
  audio: { running: boolean };
  audioStatus: Record<string, string | undefined>;
  audioProgress?: ReadonlyMap<string, AudioPhase>;
  desktop: { overlayVisible?: boolean; settings: { autoAnswer?: boolean; systemAudio?: boolean; transcribeMicrophone?: boolean } };
  modes: PanelMode[];
  selectedMode: string;
  historyPager: PanelPager;
  actions: Record<ModeBase, [string, string, string][]>;
  library: {
    documents: unknown[];
    prompts: { id: string; title: string; mode: ModeBase }[];
  };
  profile: { name?: string; role?: string } | null;
  prefs: { code: string };
  coding: Pick<CodingState, "attempt" | "captures" | "language"> | null;
  answerPhase: string;
  liveQuestion: string;
  liveText: string;
  modeBase(id: string): ModeBase;
  modeName(id: string): string;
  esc(value: unknown): string;
  icon(name: string | undefined, size?: number): string;
  ib(icon: string, action: string, title: string): string;
  button(label: string, action: string, style?: string, icon?: string): string;
  select(
    key: string,
    values: (string | [string, string])[],
    value: string,
  ): string;
  time(seconds: number): string;
  duration(): number;
  markdown(text: string): string;
  actionTitle(action: string, mode?: ModeBase): string;
  codingResponseActions(response: PanelResponse): string;
  codingAttemptView(): string;
};
