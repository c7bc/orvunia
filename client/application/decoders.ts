import { modeResult } from "../commands/boundary.js";
import { applicationSession } from "./history-boundary.js";
import { providerState } from "../providers/contracts.js";
import { array, record, text } from "../legacy-web/validation.js";
import type { ApplicationHealth, ApplicationState } from "./model.js";

function mode(value: unknown): "recruiter" | "technical" {
  if (value !== "recruiter" && value !== "technical")
    throw Error("Modo inválido do servidor.");
  return value;
}
function preferences(value: unknown): ApplicationState["prefs"] {
  const item = record(value);
  const modes = (value: unknown) => {
    const item = record(value);
    return { recruiter: text(item.recruiter), technical: text(item.technical) };
  };
  return {
    ...item,
    output: text(item.output),
    audio: text(item.audio),
    code: text(item.code),
    source: text(item.source),
    instructions: text(item.instructions),
    ...(item.modeInstructions === undefined
      ? {}
      : { modeInstructions: modes(item.modeInstructions) }),
    ...(item.noteTemplates === undefined
      ? {}
      : { noteTemplates: modes(item.noteTemplates) }),
  };
}
export function applicationBootstrap(value: unknown) {
  const item = record(value);
  const before = item.sessionIndex ? record(item.sessionIndex).before : null;
  if (before !== null && before !== undefined && typeof before !== "string")
    throw Error("Cursor inválido do servidor.");
  const profile = item.profile === null ? null : record(item.profile);
  const parsedProfile: Record<string, string> = {};
  if (profile)
    for (const [key, value] of Object.entries(profile))
      parsedProfile[key] = text(value);
  return {
    workspaceId: text(item.workspaceId),
    sessions: array(item.sessions, applicationSession),
    profile: profile ? parsedProfile : null,
    preferences: preferences(item.preferences),
    before: before || null,
  };
}
export function applicationLibrary(
  value: unknown,
): ApplicationState["library"] {
  const item = record(value);
  return {
    documents: array(item.documents, (value) => {
      const item = record(value);
      return {
        ...item,
        id: text(item.id),
        name: text(item.name),
        text: text(item.text),
      };
    }),
    prompts: array(item.prompts, (value) => {
      const item = record(value);
      return {
        ...item,
        id: text(item.id),
        title: text(item.title),
        instructions: text(item.instructions),
        mode: mode(item.mode),
      };
    }),
  };
}
export function applicationHealth(value: unknown): ApplicationHealth {
  const item = record(value);
  if (item.deployment === "cloud") {
    const capabilities = item.capabilities === undefined ? null : record(item.capabilities);
    const ready = (capability: string) => capabilities ? capabilities[capability] === "ready" : item.keyConfigured === true;
    return { deployment: "cloud", keyConfigured: ready("text") && ready("transcription"),
      realtimeSupported: item.realtimeSupported === true };
  }
  if (
    item.deployment !== undefined &&
    item.deployment !== "cloud" &&
    item.deployment !== "local"
  )
    throw Error("Instalação inválida do servidor.");
  if (
    item.realtimeSupported !== undefined &&
    typeof item.realtimeSupported !== "boolean"
  )
    throw Error("Configuração de áudio inválida.");
  if (
    item.keyConfigured !== undefined &&
    typeof item.keyConfigured !== "boolean"
  )
    throw Error("Configuração de provedores inválida.");
  const models = item.models === undefined ? undefined : record(item.models);
  return {
    ...item,
    ...(item.deployment === undefined ? {} : { deployment: "local" as const }),
    ...(item.realtimeSupported === undefined
      ? {}
      : { realtimeSupported: item.realtimeSupported }),
    ...(item.keyConfigured === undefined
      ? {}
      : { keyConfigured: item.keyConfigured }),
    ...(item.keySource === undefined
      ? {}
      : { keySource: text(item.keySource) }),
    ...(models === undefined
      ? {}
      : {
          models: {
            ...models,
            response: text(models.response),
            transcription: text(models.transcription),
            ...(models.realtime === undefined
              ? {}
              : { realtime: text(models.realtime) }),
          },
        }),
  };
}
export const applicationModes = modeResult;
export const applicationProviders = providerState;
export { applicationSession } from "./history-boundary.js";
