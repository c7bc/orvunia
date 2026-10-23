import type { OverlayState } from "./state.js";
import { hasOverlaySpeech } from "./speech.js";

type ExpansionState = Pick<OverlayState,
  "current" | "partialTranscripts" | "chatCollapsed" | "busy" | "activeAnswerRequest" | "tab">;

export function isOverlayExpanded(state: ExpansionState, hasAttempt = false) {
  const { current, chatCollapsed, busy, activeAnswerRequest, tab } = state;
  return Boolean(
    ((current?.responses.length || hasOverlaySpeech(state) || hasAttempt) && !chatCollapsed) ||
    (busy && current && activeAnswerRequest?.sessionId === current.id) ||
    tab !== "answers",
  );
}
