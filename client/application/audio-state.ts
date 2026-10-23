import type { ApplicationAudioPorts } from "./audio-contracts.js";
import { updateAudioProgress } from "../audio-status/progress.js";
import type { AudioPhase } from "../audio-status/domain.js";
import { listeningError } from "../studio/audio-error.js";
export function createAudioPresentation(ports: ApplicationAudioPorts) {
  function progress(sessionId: string, kind: string, phase: AudioPhase) {
    if (!updateAudioProgress(ports.state.audioProgress, sessionId, kind, phase)) return;
    ports.broadcast({ type: "audio-progress", sessionId, kind, phase });
    ports.refreshActivity();
  }
  return (kind: string, status: string, detail: unknown, sessionId: string) => {
    const state = ports.state;
    if (status === "activity") {
      if (state.audioSessionId !== sessionId) return;
      const activity = detail && typeof detail === "object" ? detail : null;
      const at = activity && "at" in activity ? activity.at : undefined;
      const value = {
        sessionId,
        kind,
        active: !!activity && "active" in activity && activity.active === true,
        at:
          (typeof at === "string" || typeof at === "number" ? Number(at) : 0) ||
          ports.clock(),
      };
      state.voiceActivity.set(sessionId + ":" + kind, value);
      const current = state.audioProgress.get(sessionId + ":" + kind);
      if (value.active && ["listening", "saved"].includes(current || ""))
        progress(sessionId, kind, "detected");
      ports.broadcast({ type: "voice-activity", ...value });
      ports.refreshActivity();
      return;
    }
    const phases: Record<string, AudioPhase> = {
      starting: "starting", selecting: "selecting", recording: "listening",
      transcribing: "transcribing", ended: "off", disabled: "off",
      error: "error", backpressure: "error",
    };
    if (status === "queued" && typeof detail === "number") {
      if (state.audioSessionId !== sessionId || !Number.isSafeInteger(detail) || detail < 0) return;
      state.audioPending.set(sessionId + ":" + kind, detail);
      if (detail > 0) progress(sessionId, kind, "transcribing");
      else if (state.audioProgress.get(sessionId + ":" + kind) === "transcribing")
        progress(sessionId, kind, "listening");
    } else if (phases[status]) progress(sessionId, kind, phases[status]);
    ports.broadcast({ type: "audio", running: ports.audio.running });
    if (!["recording", "ended", "error", "backpressure"].includes(status))
      return;
    state.audioStatus[kind] = status === "recording" ? "recording" : "off";
    if (status !== "recording") {
      state.audioPending.delete(sessionId + ":" + kind);
      for (const [key, value] of state.partialTranscripts)
        if (value.sessionId === sessionId && value.kind === kind)
          state.partialTranscripts.delete(key);
      ports.refreshActivity();
    }
    if (detail && status !== "recording") ports.toast(ports.translate(listeningError(detail)));
    const label = ports.document.querySelector("#audio-label");
    if (label) label.textContent = ports.label();
    if (status === "error" || status === "backpressure") ports.render();
  };
}
