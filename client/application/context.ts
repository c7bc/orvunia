import type { ApplicationState } from "./model.js";
import type { ApplicationRequest } from "./request.js";
import type { ApplicationNative } from "./native.js";
import type {
  MarkdownPlatform,
  createApplicationMarkdown,
} from "./markdown.js";
import type { createApplicationPresentation } from "./presentation.js";
import type { createApplicationNavigation } from "./navigation.js";
import type { createApplicationLayout } from "./layout.js";
import type { createApplicationModal } from "./modal.js";
import type { createApplicationCoding } from "./coding.js";
import type { createApplicationAnswer } from "./answer.js";
import type { createApplicationAudio } from "./audio.js";
import type { createApplicationUploads } from "./uploads.js";
import type { createApplicationCaptures } from "./captures.js";
import type {
  createApplicationConnections,
  createApplicationModes,
  createApplicationDialogs,
  createApplicationMicrophone,
} from "../application-services/index.js";
import type { createApplicationExport } from "../application-export/index.js";
import type { createSearchPresentation } from "../application-search/index.js";
import type { createCalendarImport } from "../application-calendar/index.js";
import type { createHistoryPager } from "../history/pager.js";
import type { createHistoryDomPreserver } from "../history/index.js";
import type { createHistoryApplication } from "../history-application/index.js";
import type { createCommandSearch } from "../history-application/command-search.js";
import type { CommandSession } from "../commands/model.js";
import type { installSessionNotes } from "../notes/index.js";
import type { installModePromptEditor } from "../prompt/index.js";
import type {
  createSessionLifecycle,
  createTitleEditor,
  createRendererShutdown,
} from "../sessions/index.js";
import type { createReferenceImporter } from "../documents/index.js";
import type { ApplicationMode } from "./model.js";
import type { createFollowupController } from "../followups/controller.js";
import type { StudioAudio } from "../studio/index.js";
import type { PanelState } from "../panel/state.js";
import type { OverlayState } from "../overlay/state.js";
import type { createApplicationCommands } from "./commands.js";
import type { createApplicationSynchronization } from "./synchronization.js";
import type { createApplicationStartup } from "./startup.js";
import type { createApplicationReview } from "./review.js";
import type { createApplicationSessions } from "./sessions.js";
import type { createApplicationStorageOperations } from "./storage-operations.js";
import type { createApplicationTranscription } from "./transcription.js";
import type { createApplicationRepository } from "./repository.js";

export type ApplicationEnvironment = {
  document: Document;
  window: Window;
  markdown: MarkdownPlatform;
  broadcast: Pick<BroadcastChannel, "postMessage" | "close" | "onmessage">;
  identifier(): string;
  escapeSelector(value: string): string;
  url: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  blob: typeof Blob;
  clock(): number;
  fetch(input: string, options?: RequestInit): Promise<Response>;
  locale(): string;
  setLocale(value: string, options?: { notify?: boolean }): unknown;
  translate(
    value: string,
    parameters?: Record<string, string | number>,
  ): string;
  translateUI(root: HTMLElement | null): void;
  observeUI(root: HTMLElement | null): unknown;
  icon(name: string | undefined, size?: number): string;
};
export type ApplicationRendering = {
  render(): void;
  panel(): PanelState;
  overlay(): OverlayState;
  refreshActivity(): void;
  refreshTranscript(): void;
  partial(
    kind: string,
    item: string,
    text: string,
    done: boolean,
    sessionId: string | undefined,
    remote: boolean,
    relativeMs: number,
    utteranceId?: string,
  ): void;
  dispose(): void;
};
export type ApplicationContext = {
  environment: ApplicationEnvironment;
  state: ApplicationState;
  native: ApplicationNative | null;
  request: ApplicationRequest;
  presentation: ReturnType<typeof createApplicationPresentation>;
  navigation: ReturnType<typeof createApplicationNavigation>;
  markdown: ReturnType<typeof createApplicationMarkdown>;
  layout: ReturnType<typeof createApplicationLayout>;
  modal: ReturnType<typeof createApplicationModal>;
  coding: ReturnType<typeof createApplicationCoding>;
  answer: ReturnType<typeof createApplicationAnswer>;
  repository: ReturnType<typeof createApplicationRepository>;
  connections: ReturnType<typeof createApplicationConnections>;
  modes: ReturnType<typeof createApplicationModes>;
  dialogs: ReturnType<typeof createApplicationDialogs>;
  microphone: ReturnType<typeof createApplicationMicrophone>;
  audio: StudioAudio;
  audioFeature: ReturnType<typeof createApplicationAudio>;
  uploads: ReturnType<typeof createApplicationUploads>;
  captures: ReturnType<typeof createApplicationCaptures>;
  historyPager: ReturnType<typeof createHistoryPager>;
  historyDom: ReturnType<typeof createHistoryDomPreserver>;
  reviewHistoryDom: ReturnType<typeof createHistoryDomPreserver>;
  notes: ReturnType<typeof installSessionNotes>;
  prompt: ReturnType<typeof installModePromptEditor>;
  lifecycle: ReturnType<typeof createSessionLifecycle<CommandSession>>;
  titles: ReturnType<typeof createTitleEditor<CommandSession>>;
  shutdown: ReturnType<typeof createRendererShutdown>;
  references: ReturnType<typeof createReferenceImporter<ApplicationMode>>;
  followup: ReturnType<typeof createFollowupController>;
  history: ReturnType<typeof createHistoryApplication<CommandSession>>;
  commandSearch: ReturnType<typeof createCommandSearch>;
  search: ReturnType<typeof createSearchPresentation>;
  exporter: ReturnType<typeof createApplicationExport>;
  importCalendar: ReturnType<typeof createCalendarImport>;
  rendering: ApplicationRendering;
  commands: ReturnType<typeof createApplicationCommands>;
  synchronization: ReturnType<typeof createApplicationSynchronization>;
  startup: ReturnType<typeof createApplicationStartup>;
  review: ReturnType<typeof createApplicationReview>;
  sessions: ReturnType<typeof createApplicationSessions>;
  storage: ReturnType<typeof createApplicationStorageOperations>;
  transcripts: ReturnType<typeof createApplicationTranscription>;
  filteredSessions(): string;
};
