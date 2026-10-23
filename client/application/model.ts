import type {
  CommandDesktop,
  CommandState,
  ModeTemplate,
} from "../commands/model.js";
import type { PanelMode } from "../panel/data.js";
import type { ProviderState } from "../providers/contracts.js";
import type { AudioPhase } from "../audio-status/domain.js";
import type { RevealFrame } from "../coding/reveal.js";
import type { createMicrophoneTest } from "../microphone/controller.js";
import type {
  PartialTranscript,
  VoiceActivity,
} from "../application-render/activity.js";

export type ApplicationHealth = {
  deployment?: "local";
  realtimeSupported?: boolean;
  keyConfigured?: boolean;
  keySource?: string;
  models?: { response?: string; transcription?: string; realtime?: string };
} | {
  deployment: "cloud"; realtimeSupported?: boolean; keyConfigured?: boolean;
  keySource?: never; models?: never;
};
export interface ApplicationDesktop extends CommandDesktop {
  active?: { id: string } | null;
  version?: string;
  platform?: string;
  arch?: string;
  gaze?: { enabled?: boolean };
}
export type NavigationEntry = {
  page: string;
  settingsTab: string;
  modeEditor: string;
  detailTab: string;
  session: string | null | undefined;
  modeCatalog: boolean;
  key: string;
};
export type ApplicationMode = PanelMode & {
  sections?: { title: string; instructions: string }[];
};
export interface ApplicationState extends CommandState {
  generatedRecapFallback: { sessionId: string; text: string } | null;
  desktop: ApplicationDesktop;
  modes: ApplicationMode[];
  modeTemplates: ModeTemplate[];
  health: ApplicationHealth;
  liveText: string;
  liveQuestion: string;
  started: number;
  elapsedBase: number;
  audioStatus: {
    microphone: string;
    system: string;
    [key: string]: string | undefined;
  };
  audioProgress: Map<string, AudioPhase>;
  audioPending: Map<string, number>;
  lastAuto: number;
  workspaceKey: string;
  auxiliaryModal: boolean;
  lastOverlayHeight: number;
  layoutTimer: number | null;
  navigationTrail: NavigationEntry[];
  navigationIndex: number;
  restoringNavigation: boolean;
  ambientStarting: Promise<void> | null;
  preparedRevealFrame: RevealFrame | null;
  answerPhase: string;
  captureInProgress: boolean;
  detailDrafts: Map<string, string>;
  sessionIndexBefore: string | null;
  sessionSearchItems: CommandState["sessions"];
  audioSessionId: string | null;
  audioTimeOrigin: number;
  voiceActivity: Map<string, VoiceActivity>;
  partialTranscripts: Map<string, PartialTranscript>;
  modeDrafts: Map<string, { notes?: string; systemPrompt?: string; instructions?: string }>;
  providerState: ProviderState | null;
  accountMarkup: Record<string, string>;
  accountLoading: Set<string>;
  accountCleanup: (() => void) | null;
  calendarCleanup: (() => void) | null;
  gazeCleanup: (() => void) | null;
  microphoneTest: ReturnType<typeof createMicrophoneTest> | null;
  remoteAudio: boolean;
}
