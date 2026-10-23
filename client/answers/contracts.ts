import type { AnswerRequest, AnswerSession } from "./domain.js";
import type { createCodingWorkspace } from "../coding/workspace.js";
import type { GeneratedNote } from "../notes/contracts.js";
import type { Capture } from "../coding/domain.js";
export type AnswerState = {
  view: string;
  current: AnswerSession | null;
  selectedMode: string;
  settings: { ambientChat?: boolean; autoScreen?: boolean };
  native: boolean;
  source: { id: string } | null;
  ambientStarting: Promise<void> | null;
  reviewChatSessionId: string | null;
  codeLanguage: string;
  chatCollapsed: boolean;
  busy: boolean;
  controller: AbortController | null;
  draft: string;
  liveText: string;
  liveQuestion: string;
  tab: string;
  activeAnswerRequest: AnswerRequest | null;
  answerPhase: string;
};
export type AnswerContext = {
  state: AnswerState;
  coding: ReturnType<typeof createCodingWorkspace>;
  audio: {
    running: boolean;
    flush(options: {
      signal: AbortSignal;
      timeoutMs: number;
    }): Promise<unknown>;
  };
  tellMore: {
    stats(): { active: number };
    cancelActive(): Promise<unknown>;
    prepare(sessionId: string, responseId: string): Promise<unknown>;
  };
  question(): string | undefined;
  focusQuestion(): void;
  latest(session: AnswerSession): void;
  identify(): string;
  begin(mode: string, title: string): Promise<void>;
  modeName(mode: string): string;
  broadcast(message: { type: string; action?: string; key?: string; sessionId?: string }): void;
  render(): void;
  toast(message: string): void;
  sync(): Promise<void>;
  capture(id: string): Promise<unknown>;
  session(id: string): Promise<AnswerSession>;
  upload(
    blob: Blob,
    name: string,
    sessionId: string,
    signal: AbortSignal,
    uploadKey: string,
  ): Promise<Capture>;
  fetch(url: string, options: RequestInit): Promise<Response>;
  paint(text: string, request: AnswerRequest): void;
  progress(text: string, sessionId: string): void;
  applyGenerated(
    sessionId: string,
    text: string,
    token: GeneratedNote,
  ): Promise<unknown>;
  generatedFallback(sessionId: string, text: string, message: string): void;
};
export function answerCurrent(context: AnswerContext, request: AnswerRequest) {
  return (
    request.workspaceGeneration === context.coding.generation &&
    context.state.current?.id === request.sessionId &&
    context.state.activeAnswerRequest === request
  );
}
export function assertAnswerActive(
  context: AnswerContext,
  request: AnswerRequest,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (
    request.workspaceGeneration !== context.coding.generation ||
    context.state.activeAnswerRequest !== request
  )
    throw new DOMException("Interrupted", "AbortError");
}
