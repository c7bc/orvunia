import type { ApplicationEventPorts } from "./events-contracts.js";
import { eventFailure } from "./events-contracts.js";
import type { PanelTranscript } from "../panel/data.js";
import { updateAudioProgress, validAudioPhase } from "../audio-status/progress.js";
import { isUtteranceIdentifier } from "../audio/utterance.js";

function transcript(value: unknown): value is PanelTranscript {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "text" in value &&
    typeof value.text === "string" &&
    "who" in value &&
    typeof value.who === "string" &&
    "time" in value &&
    typeof value.time === "string"
    && (!("utteranceId" in value) || value.utteranceId === undefined || isUtteranceIdentifier(value.utteranceId))
  );
}

export function createBroadcastHandler(ports: ApplicationEventPorts) {
  let disposed = false;
  const { state, document } = ports;
  async function receive(value: unknown) {
    if (
      disposed ||
      document.body?.inert ||
      !value ||
      typeof value !== "object" ||
      !("type" in value)
    )
      return;
    const data = value as Record<string, unknown>;
    const active =
      typeof data.sessionId === "string" &&
      state.sessions.some(
        (session) =>
          session.id === data.sessionId && session.state === "active",
      );
    const channel = data.kind === "microphone" || data.kind === "system";
    if (data.type === "audio-progress" && channel && active &&
      typeof data.sessionId === "string" && typeof data.kind === "string" &&
      validAudioPhase(data.phase)) {
      updateAudioProgress(state.audioProgress, data.sessionId, data.kind, data.phase);
      ports.refreshActivity();
    }
    if (
      data.type === "voice-activity" &&
      channel &&
      active &&
      typeof data.at === "number" &&
      Number.isFinite(data.at) &&
      Math.abs(ports.clock() - data.at) < 1000
    ) {
      state.voiceActivity.set(data.sessionId + ":" + data.kind, {
        active: data.active === true,
        at: data.at,
      });
      while (state.voiceActivity.size > 8) {
        const oldest = state.voiceActivity.keys().next().value;
        if (oldest !== undefined) state.voiceActivity.delete(oldest);
      }
      ports.refreshActivity();
    }
    if (
      data.type === "partial-transcript" &&
      channel &&
      active &&
      (data.utteranceId === undefined || isUtteranceIdentifier(data.utteranceId)) &&
      typeof data.sessionId === "string"
    )
      ports.partialTranscript(
        String(data.kind),
        String(data.item).slice(0, 100),
        String(data.text || "").slice(0, 16000),
        data.done === true,
        data.sessionId,
        true,
        Number(data.relativeMs) || 0,
        typeof data.utteranceId === "string" ? data.utteranceId : undefined,
      );
    if (data.type === "visibility" && state.view === "overlay") {
      if (!data.visible) ports.cancelPrepared();
      const overlay = document.querySelector<HTMLElement>(".overlay-shell");
      if (overlay) overlay.hidden = !data.visible;
    }
    if (data.type === "audio" && state.view === "control") {
      state.remoteAudio = data.running === true;
      ports.render();
    }
    if (
      data.type === "changed" &&
      state.view !== "control" &&
      !document.hidden
    ) {
      const workspace = ports.workspace();
      await ports.sync();
      if (disposed || ports.workspace() !== workspace) return;
      if (
        !state.busy &&
        !document.querySelector("form input:focus,form textarea:focus")
      )
        ports.render();
    }
    if (data.type === "session-changed" && typeof data.sessionId === "string" &&
      state.current?.id === data.sessionId && state.view !== "control" && !document.hidden) {
      const workspace = ports.workspace();
      await ports.syncSession(data.sessionId);
      if (disposed || ports.workspace() !== workspace || state.current?.id !== data.sessionId) return;
      if (!state.busy && !document.querySelector("form input:focus,form textarea:focus")) ports.render();
    }
    const current = state.current,
      incoming = data.transcript;
    if (
      data.type === "transcript" &&
      current &&
      current.id === data.sessionId &&
      transcript(incoming) &&
      !current.transcripts.some((item) => item.id === incoming.id)
    )
      ports.acceptTranscript(incoming, current.id, false);
    if (data.type === "command" && state.view === "overlay") {
      if (data.action === "listen") await ports.listen();
      if (data.action === "ask" && typeof data.key === "string")
        await ports.ask(data.key);
      if (data.action === "end") await ports.end();
    }
  }
  return {
    async receive(value: unknown) {
      try {
        await receive(value);
      } catch (error) {
        if (!disposed) ports.toast(eventFailure(error));
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
