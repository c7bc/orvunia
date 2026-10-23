import type { BrowserPorts } from "./contracts.js";
import { localizePractice } from "./practice-spanish.js";
import type {
  BrowserState,
  SessionReport,
  Transcript,
  InterviewMode,
} from "./models.js";
export type PracticeCase =
  [number[], number, number | number[]] | [string, boolean];
export interface PracticeProblem {
  title: string;
  desc: string;
  input: string;
  output: string;
  constraints: string;
  approach: string;
  steps: string[];
  time: string;
  space: string;
  tradeoff: string;
  codes: Record<string, string>;
  tests: PracticeCase[];
}
export interface PracticeResult {
  actual: unknown;
  expected: unknown;
  passed: boolean;
  input: string;
}
export interface WorkspaceState extends BrowserState {
  codeTab: string;
  testsRun: boolean;
  testResults: PracticeResult[];
  currentReport: SessionReport | null;
  toastTimeout: number | undefined;
  drag: { x: number; y: number } | null;
  session: BrowserState["session"] & { extraIndex: number };
}
export interface WorkspaceData {
  icons: Record<string, string>;
  initialTranscripts: Record<InterviewMode, Transcript[]>;
  extraTranscripts: Record<InterviewMode, { who: string; text: string }[]>;
  problems: Record<string, PracticeProblem>;
}
export interface WorkspacePorts extends Omit<BrowserPorts, "audio"> {
  window: Window;
  data: WorkspaceData;
  problems: WorkspaceData["problems"];
  live(): ReturnType<typeof import("./index.js").createLegacyLive>;
  storage: { write(key: string, value: unknown): void };
}
export interface WorkspaceController {
  decorate(root?: ParentNode): void;
  problemTranscript(id: string): Transcript[];
  toast(message: string): void;
  renderProfile(): void;
  renderSession(): void;
  renderInput(): void;
  problemHTML(): string;
  recruiterContent(): string;
  answerMeta(text: string): string;
  technicalContent(): string;
  renderAnswer(): void;
  renderMode(): void;
  cancelGeneration(): void;
  generate(kind?: string): Promise<void>;
  modal(title: string, body: string, footer?: string): void;
  contextModal(): void;
  settingsModal(): void;
  historyModal(): void;
  summaryModal(report: SessionReport): void;
  endSession(): void | Promise<void>;
  newSession(): void | Promise<void>;
  resetSession(): void;
  simulateCapture(): void | Promise<void>;
  copy(text: string): Promise<void>;
  downloadText(name: string, text: string): void;
  runTests(): void;
}
export interface WorkspaceContext {
  state: WorkspaceState;
  ports: WorkspacePorts;
  workspace: WorkspaceController;
}
export type WorkspaceActions = Record<string, () => void | Promise<void>>;
export function workspaceProblem(
  ports: WorkspacePorts,
  id: string,
  locale = "pt-BR",
): PracticeProblem {
  const problem = ports.problems[id];
  if (!problem) throw Error("Escolha um desafio válido.");
  return localizePractice(problem, id, locale);
}
