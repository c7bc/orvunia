import type { ApplicationAudioPorts } from "./audio-contracts.js";
import type { Transcript } from "../realtime/contracts.js";
import { commandTranscript } from "../commands/boundary.js";
import { createAudioTranscription } from "../studio/transcription.js";
import { createListening } from "../studio/listening.js";
import { createAudioPresentation } from "./audio-state.js";

function result(
  value: unknown,
): (Transcript & { empty?: false }) | { empty: true } {
  if (
    value &&
    typeof value === "object" &&
    "empty" in value &&
    value.empty === true
  )
    return { empty: true };
  const transcript = commandTranscript(value);
  if (
    !value ||
    typeof value !== "object" ||
    !("source" in value) ||
    typeof value.source !== "string"
  )
    throw Error("Transcrição inválida do servidor.");
  if ("segmentId" in value && typeof value.segmentId !== "string")
    throw Error("Transcrição inválida do servidor.");
  return {
    ...transcript,
    source: value.source,
    ...("segmentId" in value && typeof value.segmentId === "string"
      ? { segmentId: value.segmentId }
      : {}),
  };
}
export function createApplicationAudio(ports: ApplicationAudioPorts) {
  const state = ports.state;
  const context = () => ({
    workspace: state.workspaceKey,
    audioSessionId: state.audioSessionId,
    audioTimeOrigin: state.audioTimeOrigin,
    language: state.prefs.audio,
  });
  const transcription = createAudioTranscription({
    current: () => state.current,
    context,
    clock: ports.clock,
    duration: ports.duration,
    format: ports.format,
    identifier: ports.identifier,
    request: async (path, body, signal, workspace) =>
      result(
        await ports.request(path, "POST", body, signal, {
          "X-Cadence-Workspace": workspace.slice("cadence-agenda:".length),
        }),
      ),
    accept: ports.accept,
  });
  const presentation = createAudioPresentation(ports);
  function updateState(kind: string, status: string, detail: unknown, sessionId: string) {
    presentation(kind, status, detail, sessionId);
    if (status === "recording") ports.resumeAutomatic?.();
  }
  const listening = createListening({
    audio: ports.audio,
    current: () => state.current,
    workspace: () => state.workspaceKey,
    blocked: () => Boolean(ports.document.body?.inert),
    view: () => state.view,
    settings: () => ({
      ...state.desktop.settings,
      systemAudio: !!state.desktop.settings.systemAudio,
      realtime:
        !!state.desktop.settings.realtime &&
        state.health.realtimeSupported !== false,
      pcmChunks: true,
    }),
    context,
    clock: ports.clock,
    duration: ports.duration,
    format: ports.format,
    began: (sessionId, origin) => {
      state.audioSessionId = sessionId;
      state.audioTimeOrigin = origin;
      state.voiceActivity.clear();
      state.partialTranscripts.clear();
      state.audioProgress.clear();
      state.audioPending.clear();
    },
    state: updateState,
    transcribe: transcription.send,
    transcript: ports.accept,
    partial: ports.partial,
    hasSource: () => Boolean(state.source),
    chooseSource: ports.chooseSource,
    ...(ports.nativeSystemAudio ? { nativeSystemAudio: ports.nativeSystemAudio } : {}),
    broadcast: ports.broadcast,
    stopped: () => {
      if (state.current)
        for (const kind of ["microphone", "system"])
          presentation(kind, "ended", undefined, state.current.id);
      state.audioStatus = { microphone: "off", system: "off" };
      state.audioPending.clear();
      state.audioProgress.clear();
      ports.broadcast({ type: "audio", running: false });
    },
    render: ports.render,
    toast: ports.toast,
    translate: ports.translate,
  });
  return { transcription, listening, state: updateState };
}
