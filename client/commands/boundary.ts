import type { PanelMode, PanelTranscript } from "../panel/data.js";
import { utteranceFields } from "../audio/utterance.js";
import type {
  CommandSession,
  ModeResult,
  ModeTemplate,
  CommandPrompt,
} from "./model.js";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Resposta inválida do servidor.");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw Error("Resposta inválida do servidor.");
  return value;
}
function list<Value>(
  value: unknown,
  decode: (value: unknown) => Value,
): Value[] {
  if (!Array.isArray(value)) throw Error("Resposta inválida do servidor.");
  return value.map(decode);
}
function base(value: unknown): "recruiter" | "technical" {
  if (value !== "recruiter" && value !== "technical")
    throw Error("Modo inválido do servidor.");
  return value;
}
export function commandTranscript(value: unknown): PanelTranscript {
  const item = object(value);
  return {
    ...item,
    id: string(item.id),
    text: string(item.text),
    who: string(item.who),
    time: string(item.time),
    ...utteranceFields(item.utteranceId),
  };
}
export function commandSession(value: unknown): CommandSession {
  const item = object(value);
  if (typeof item.elapsed !== "number" || !Number.isFinite(item.elapsed))
    throw Error("Duração inválida do servidor.");
  return {
    ...item,
    id: string(item.id),
    title: string(item.title),
    date: string(item.date),
    state: string(item.state),
    mode: base(item.mode),
    elapsed: item.elapsed,
    responses: list(item.responses, (value) => {
      const response = object(value);
      return {
        ...response,
        id: string(response.id),
        text: string(response.text),
        action: string(response.action),
        ...(response.sourceTranscriptIds === undefined ? {} : { sourceTranscriptIds: list(response.sourceTranscriptIds, string) }),
        ...(response.captureIds === undefined
          ? {}
          : { captureIds: list(response.captureIds, string) }),
      };
    }),
    transcripts: list(item.transcripts, commandTranscript),
    captures: list(item.captures, (value) => {
      const capture = object(value);
      return { ...capture, id: string(capture.id), url: string(capture.url) };
    }),
  };
}
function mode(value: unknown): PanelMode {
  const item = object(value);
  return {
    ...item,
    id: string(item.id),
    name: string(item.name),
    base: base(item.base),
    ...(item.systemPrompt === undefined ? {} : { systemPrompt: string(item.systemPrompt) }),
    ...(item.instructions === undefined ? {} : { instructions: string(item.instructions) }),
    ...(item.sections === undefined
      ? {}
      : {
          sections: list(item.sections, (value) => {
            const section = object(value);
            return {
              ...section,
              title: string(section.title),
              instructions: string(section.instructions),
            };
          }),
        }),
    documents: list(item.documents, (value) => {
      const document = object(value);
      return {
        ...document,
        id: string(document.id),
        name: string(document.name),
        text: string(document.text),
      };
    }),
  };
}
export { mode as readMode };
export function modeResult(value: unknown): ModeResult {
  const item = object(value);
  return {
    modes: list(item.modes, mode),
    activeId: string(item.activeId),
    ...(item.mode === undefined ? {} : { mode: mode(item.mode) }),
    ...(item.templates === undefined
      ? {}
      : { templates: list(item.templates, template) }),
  };
}
function template(value: unknown): ModeTemplate {
  const item = object(value);
  return {
    ...item,
    id: string(item.id),
    name: string(item.name),
    base: base(item.base),
  };
}
export function requiredMode(result: ModeResult): PanelMode {
  if (!result.mode)
    throw Error("O modo criado não foi confirmado pelo servidor.");
  return result.mode;
}
export function commandPrompt(value: unknown, id: string): CommandPrompt {
  const item = object(value);
  return {
    ...item,
    id,
    title: string(item.title),
    instructions: string(item.instructions),
    mode: base(item.mode),
  };
}
