import type { ApiRequestOptions } from "../http/api.js";
import type { ChunkCallback, StateCallback } from "../audio/contracts.js";
import type {
  Answer,
  BrowserState,
  Health,
  InterviewMode,
  ModeValues,
  Problem,
  SessionReport,
} from "./models.js";
export interface BrowserPorts {
  api: {
    request(path: string, options?: ApiRequestOptions): Promise<unknown>;
    answer(
      id: string,
      input: unknown,
      signal: AbortSignal,
      delta: (text: string) => void,
    ): Promise<unknown>;
  };
  audio: {
    start(
      source: string,
      chunk: ChunkCallback,
      state: StateCallback,
    ): Promise<void>;
    stop(): Promise<void>;
  };
  document: Document;
  media: Pick<MediaDevices, "getDisplayMedia">;
  randomUUID(): string;
  abortController(): AbortController;
  element(selector: string): HTMLElement;
  optional(selector: string): HTMLElement | null;
  field(selector: string): HTMLInputElement;
  button(selector: string): HTMLButtonElement;
  dialog(): HTMLDialogElement;
  icon(name: string): string;
  escape(value: unknown): string;
  markdown(value: string): string;
  sanitize(
    value: string,
    options: { FORBID_TAGS: string[]; FORBID_ATTR: string[] },
  ): string;
  formatTime(seconds: number): string;
  toast(message: string): void;
  modal(title: string, body: string, footer?: string): void;
  copy(text: string): Promise<void>;
  write(key: string, value: unknown): void;
  problems: Record<string, Problem>;
  problemHTML(): string;
  renderProfile(): void;
  renderMode(): void;
  renderSession(): void;
  renderInput(): void;
  renderAnswer(): void;
  historyModal(): void;
  summaryModal(report: SessionReport): void;
  cancelGeneration(): void;
}
export interface LiveController {
  sessionId: string | null;
  creating: Promise<string> | null;
  health: Health | null;
  answers: ModeValues<Answer | null>;
  controller: AbortController | null;
  audio: BrowserPorts["audio"];
  recording: boolean;
  practiceSelected: boolean;
  pendingChunks: number;
  boot(): Promise<void>;
  reportError(error: unknown): void;
  cancel(): void;
  showHistory(): Promise<void>;
  ensureSession(): Promise<string>;
  refreshSession(): Promise<void>;
  generate(kind: string): Promise<void>;
  answerHTML(): string;
  renderSession(): void;
  problemHTML(): string;
  renderInput(): void;
  renderMode(): void;
  start(): Promise<void>;
  end(): Promise<void>;
  newSession(): Promise<void>;
  capture(): Promise<void>;
  uploadImage(blob: Blob | null): Promise<void>;
  saveContext(): Promise<void>;
  settingsModal(): void;
  saveSettings(): Promise<void>;
  tick(): void;
  addText(): void;
  saveText(): Promise<void>;
  uploadAudioModal(): void;
  transcribeFile(): Promise<void>;
  bind(): void;
}
export type BrowserContext = { state: BrowserState; ports: BrowserPorts };
export function errorDetails(error: unknown): {
  name: string;
  message: string;
} {
  if (error && typeof error === "object") {
    return {
      name: "name" in error ? String(error.name) : "Error",
      message:
        "message" in error
          ? String(error.message)
          : "Não foi possível concluir a operação.",
    };
  }
  return {
    name: "Error",
    message:
      typeof error === "string"
        ? error
        : "Não foi possível concluir a operação.",
  };
}
export function requiredHealth(controller: LiveController): Health {
  if (!controller.health) throw Error("O servidor ainda não está conectado.");
  return controller.health;
}
export function requiredProblem(ports: BrowserPorts, id: string): Problem {
  const problem = ports.problems[id];
  if (!problem) throw Error("Escolha um desafio válido.");
  return problem;
}
export function isInterviewMode(value: string): value is InterviewMode {
  return value === "recruiter" || value === "technical";
}
