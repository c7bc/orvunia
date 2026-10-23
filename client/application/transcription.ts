import type { ApplicationContext } from "./context.js";
import type { PanelTranscript } from "../panel/data.js";
import { updateAudioProgress } from "../audio-status/progress.js";
import { createAutomaticAnswer } from "./automatic-answer.js";
import { speechGroup } from "./speech-group.js";
import { isAutomaticSpeechActionable } from "./automatic-intent.js";
export function createApplicationTranscription(
  context: Pick<
    ApplicationContext,
    "state" | "environment" | "rendering" | "answer"
  >,
) {
  const { state, environment } = context;
  const queued = new Map<string, { id: string; text: string }>();
  const observed = new Set<string>();
  let queueScope: string | null = null, disposed = false;
  const scope = () => state.current?.state === "active" && state.audioSessionId === state.current.id
    ? JSON.stringify([state.workspaceKey, state.current.id, state.audioTimeOrigin, state.current.history?.generation ?? 0]) : null;
  function synchronizedScope() {
    const current = scope();
    if (current !== queueScope) { queued.clear(); observed.clear(); queueScope = current; }
    if (state.current?.history?.transcripts.total === 0 && !state.current.transcripts.length) {
      queued.clear(); observed.clear();
    }
    return current;
  }
  const automatic = createAutomaticAnswer({
    clock: environment.clock,
    schedule: (callback, delay) => environment.window.setTimeout(callback, delay),
    clear: timer => environment.window.clearTimeout(timer),
    scope: synchronizedScope,
    pauseSeconds: () => Number(state.desktop.settings.answerPauseSeconds ?? 1),
    quietSince: () => {
      const activity = state.voiceActivity.get(`${state.current?.id}:system`);
      return activity && activity.at >= state.audioTimeOrigin && activity.at <= environment.clock() &&
        (!activity.active || environment.clock() - activity.at >= 1200) ? activity.at : null;
    },
    enabled: () => state.desktop.settings.autoAnswer === true && state.audioStatus.system === "recording" &&
      !environment.document?.body?.inert && Boolean(synchronizedScope()) && queued.size > 0,
    speaking: () => {
      const activity = state.voiceActivity.get(`${state.current?.id}:system`);
      return (state.audioPending?.get(`${state.current?.id}:system`) || 0) > 0 ||
        (activity?.active === true && environment.clock() - activity.at < 1200) ||
        [...state.partialTranscripts.values()].some(item => item.sessionId === state.current?.id &&
          item.kind === "system" && item.text.trim());
    },
    busy: () => state.busy,
    lastAnswer: () => state.lastAuto,
    answer() {
      const owner = synchronizedScope(), group = speechGroup(queued.values());
      if (!owner || !group.ids.length) return;
      for (const id of group.ids) queued.delete(id);
      if (!isAutomaticSpeechActionable(group.question)) {
        if (queued.size) automatic.confirmed();
        return;
      }
      state.lastAuto = environment.clock();
      void Promise.resolve(context.answer.ask("assist", group.question, false, { sourceTranscriptIds: group.ids }))
        .catch(() => {})
        .finally(() => { if (!disposed && synchronizedScope() === owner && queued.size) automatic.confirmed(); });
    },
  });
  function queueAutomatic(transcript: PanelTranscript, sessionId: string, broadcast: boolean) {
    const current = state.current;
    if (!broadcast || current?.id !== sessionId || transcript.source !== "audio" ||
      transcript.who !== "Entrevistador" || state.desktop.settings.autoAnswer !== true ||
      !synchronizedScope() || observed.has(transcript.id) ||
      current.responses.some(response => response.sourceTranscriptIds?.includes(transcript.id))) return;
    observed.add(transcript.id);
    queued.set(transcript.id, { id: transcript.id, text: transcript.text });
    automatic.confirmed();
  }
  function accept(
    transcript: PanelTranscript,
    sessionId = state.current?.id,
    broadcast = true,
  ) {
    if (!sessionId || disposed) return;
    const target =
      state.current?.id === sessionId
        ? state.current
        : state.sessions.find((session) => session.id === sessionId);
    if (!target) return;
    if (target.transcripts.some((item) => item.id === transcript.id)) {
      queueAutomatic(transcript, sessionId, broadcast);
      return;
    }
    target.transcripts.push(transcript);
    if (target.history) target.history.transcripts.total++;
    if (transcript.source === "audio")
      updateAudioProgress(state.audioProgress, sessionId,
        transcript.who === "Eu" ? "microphone" : "system", "saved");
    if (broadcast)
      environment.broadcast.postMessage({
        type: "transcript",
        sessionId,
        transcript,
      });
    if (state.current?.id !== sessionId) return;
    context.rendering.refreshActivity();
    if (
      state.view === "panel" &&
      state.page === "detail" &&
      state.detailTab === "transcripts"
    )
      context.rendering.render();
    else context.rendering.refreshTranscript();
    queueAutomatic(transcript, sessionId, broadcast);
  }
  function partial(
    kind: string,
    item: string,
    text: string,
    done: boolean,
    sessionId = state.audioSessionId || state.current?.id,
    remote = false,
    relativeMs = environment.clock() - state.audioTimeOrigin,
    utteranceId?: string,
  ) {
    if (!done && sessionId)
      updateAudioProgress(state.audioProgress, sessionId, kind, "transcribing");
    context.rendering.partial(
      kind,
      item,
      text,
      done,
      sessionId,
      remote,
      relativeMs,
      utteranceId,
    );
  }
  function reset() { queued.clear(); observed.clear(); queueScope = null; automatic.reset(); }
  return { accept, partial, reset, resume: automatic.resume,
    dispose() { disposed = true; reset(); automatic.dispose(); } };
}
