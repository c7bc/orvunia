import type { createCodingWorkspace } from "../coding/workspace.js";
import type { createTellMoreController } from "../coding/controller.js";
import type { createFollowupController } from "../followups/controller.js";
import type { AnswerOptions } from "../answers/domain.js";
import type { PanelMode } from "../panel/data.js";
import type { PanelState } from "../panel/state.js";
import type { CommandNative } from "./native.js";
import type {
  CommandAttempt,
  CommandSettings,
  CommandState,
  ModeResult,
  CommandPrompt,
} from "./model.js";
export interface CommandPorts {
  workspace(): string;
  document: Document;
  window: Window;
  native: CommandNative | null;
  coding: ReturnType<typeof createCodingWorkspace>;
  tellMore: Pick<
    ReturnType<typeof createTellMoreController>,
    "open" | "stats" | "cancelActive"
  >;
  followup: Pick<
    ReturnType<typeof createFollowupController>,
    "copy" | "review" | "confirm"
  >;
  gaze: { stop(): void };
  audio: { stop(): Promise<unknown> };
  preparedReveal: { cancel(): void };
  sessionNotes: { value(id: string): string | undefined };
  welcome: { openOnboarding(): Promise<unknown> };
  modePromptEditor: { forget(id: string): void };
  modeDrafts: Map<string, { notes?: string; systemPrompt?: string; instructions?: string }>;
  notePresets: Record<
    string,
    { sections: { title: string; instructions: string }[] }
  >;
  accountMarkup: Record<string, string>;
  historyPager: { clear(id: string): void };
  detailDrafts: Map<string, string>;
  microphoneTest: {
    start(device: string): Promise<unknown>;
    stop(): void;
  } | null;
  request(path: string, method?: string, body?: unknown): Promise<unknown>;
  attempt(id: string): CommandAttempt | null;
  action(name: string): Promise<void>;
  ask(
    action: string,
    question?: string,
    review?: boolean,
    options?: AnswerOptions,
  ): Promise<unknown>;
  begin(mode: string, title: string): Promise<unknown>;
  activate(id: string): Promise<unknown>;
  activateMode(id: string): Promise<unknown>;
  sync(): Promise<unknown>;
  render(): void;
  toast(message: string): void;
  modal(title: string, content: string, className?: string): unknown;
  closeModal(): void;
  codingContextEditor(): void;
  codingCaptureEditor(): void;
  navigateHistory(direction: number): Promise<unknown>;
  moveHistory(kind: string, view: string, direction: string): Promise<unknown>;
  searchSessionHistory(query: string, append?: boolean): Promise<unknown>;
  setDesktop(change: Partial<CommandSettings>): Promise<unknown>;
  modeName(id: string): string;
  editedMode(): PanelMode | undefined;
  applyModes(result: ModeResult): void;
  captureModeDraft(): void;
  saveEditedMode(change: object): Promise<unknown>;
  checkUpdates(): Promise<unknown>;
  followupEditor(): Promise<unknown>;
  searchDialog(): void;
  downloadData(): Promise<unknown>;
  importCalendar(): void;
  sectionsFromTemplate(text: string): { title: string; instructions: string }[];
  editNoteSections(sections: { title: string; instructions: string }[]): void;
  noteTemplateDialog(): void;
  reviewRecap(): Promise<unknown>;
  readNoteSections(): { title: string; instructions: string }[];
  reviewAsk(selector?: string): Promise<unknown>;
  profileForm(): string;
  importFiles(): Promise<unknown>;
  promptEditor(prompt?: CommandPrompt): void;
  saveLibrary(): Promise<unknown>;
  listen(): Promise<unknown>;
  pause(): Promise<unknown>;
  end(): Promise<unknown>;
  chooseSource(purpose?: string): Promise<unknown>;
  sources(): { id: string }[];
  filePicker(
    accept: string,
    callback: (files: File[]) => void | Promise<void>,
    multiple: boolean,
  ): void;
  saveImage(
    blob: Blob,
    name: string,
    target: { id: string; mode: string; state: string } | null,
  ): Promise<unknown>;
  saveCrop(full: boolean): Promise<unknown>;
  exportSession(id: string): Promise<unknown>;
  loadDevices(): Promise<unknown>;
  openMicrophoneTest(): void;
  saveAgenda(): void;
  clearDialog(): void;
  firstCodeBlock(text: string): string;
  selectedResponseProblem(response: { text: string }, problem: string): string;
  renderScheduleForm(state: PanelState): string;
  panelState(): PanelState;
  escape(value: unknown): string;
  button(label: string, action: string, style?: string, icon?: string): string;
  translate(value: string): string;
  broadcast(value: { type: string; visible?: boolean }): void;
  escapeSelector(value: string): string;
}
export type CommandContext = { state: CommandState; ports: CommandPorts };
export type CommandHandler = (
  context: CommandContext,
  key: string,
  value: string,
) => Promise<boolean>;
