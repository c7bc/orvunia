import type { AnswerInput, AnswerRequest } from "../answers/domain.js";
import type { CommandAttempt } from "./model.js";
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
function input(value: unknown): value is AnswerInput {
  return (
    object(value) &&
    (value.mode === "recruiter" || value.mode === "technical") &&
    [
      value.requestId,
      value.action,
      value.question,
      value.problem,
      value.codeLanguage,
    ].every((item) => typeof item === "string") &&
    strings(value.captureIds)
  );
}
function request(value: unknown): value is AnswerRequest {
  if (
    !object(value) ||
    !input(value.input) ||
    typeof value.sessionId !== "string" ||
    !strings(value.captureIds) ||
    !(value.pendingIds === null || strings(value.pendingIds)) ||
    typeof value.workspaceGeneration !== "number" ||
    !Number.isFinite(value.workspaceGeneration) ||
    ![
      value.review,
      value.prepared,
      value.autoCapturePending,
      value.needsAudioFlush,
      value.audioFlushed,
    ].every((item) => typeof item === "boolean")
  )
    return false;
  const note = value.applyGenerated;
  return (
    note === null ||
    (object(note) &&
      typeof note.id === "string" &&
      typeof note.text === "string" &&
      typeof note.revision === "number" &&
      typeof note.edits === "number")
  );
}
export function readCommandAttempt(value: unknown): CommandAttempt | null {
  if (value == null) return null;
  if (
    !object(value) ||
    !input(value.input) ||
    typeof value.text !== "string" ||
    typeof value.expired !== "boolean" ||
    typeof value.review !== "boolean" ||
    (value.request !== undefined && !request(value.request))
  )
    throw Error(
      "O contexto desta tentativa não está mais disponível. Faça uma nova pergunta.",
    );
  return {
    text: value.text,
    expired: value.expired,
    input: value.input,
    review: value.review,
    ...(typeof value.cancelled === "boolean"
      ? { cancelled: value.cancelled }
      : {}),
    ...(typeof value.message === "string" ? { message: value.message } : {}),
    ...(value.request === undefined ? {} : { request: value.request }),
  };
}
