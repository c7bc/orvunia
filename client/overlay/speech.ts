import type { OverlayState } from "./state.js";
import type { PanelResponse, PanelTranscript } from "../panel/data.js";
import { renderHistoryNavigation } from "../panel/paging.js";
import { speechTurns, type SpeechTurn } from "./speech-turns.js";
export const speechHistoryView = "overlay-chat-transcripts";
const normalized = (text: string) => text.trim().replace(/\s+/g, " ");
function associated(context: OverlayState, response: PanelResponse) {
  const transcripts = context.current?.transcripts || [];
  if (response.sourceTranscriptIds?.length) {
    const ids = new Set(response.sourceTranscriptIds);
    return transcripts.filter(item => ids.has(item.id));
  }
  const question = normalized(response.question || "");
  return question ? transcripts.filter(item => normalized(item.text) === question).slice(0, 1) : [];
}
export function speechBubble(context: OverlayState, item: Pick<PanelTranscript, "id" | "text" | "who" | "time">,
  pending = false, sourceIds = [item.id]) {
  const { esc, icon } = context, translate = context.translate || ((value: string) => value);
  const speaker = item.who === "Eu" ? "Eu" : item.who === "Entrevistador" ? "Entrevistador" : item.who;
  const status = translate(pending ? "Transcrevendo…" : "Fala confirmada");
  return `<article class="chat-speech-message ${pending ? "chat-speech-partial" : ""}" data-chat-key="${esc(item.id)}" data-chat-voice="${esc(item.id)}" data-chat-source-ids="${esc(JSON.stringify(sourceIds))}" data-confirmed="${!pending}" ${pending ? 'aria-live="polite" aria-atomic="true"' : ""}><div class="chat-speech-meta">${icon(item.who === "Eu" ? "mic" : "volume", 12)}<strong>${esc(translate(speaker))}</strong><time data-i18n-skip>${esc(item.time)}</time><span class="chat-speech-state">${esc(status)}</span></div><p data-i18n-skip>${esc(item.text)}</p></article>`;
}
const renderTurns = (context: OverlayState, turns: SpeechTurn[]) =>
  turns.map(turn => speechBubble(context, turn, turn.pending, turn.sourceIds)).join("");
export function responseSpeech(context: OverlayState, response: PanelResponse, shown = new Set<string>()) {
  const items = associated(context, response).filter(item => !shown.has(item.id));
  for (const item of items) shown.add(item.id);
  return { markup: renderTurns(context, speechTurns(items, true)),
    questionShown: Boolean(response.question && normalized(response.question) ===
      normalized(associated(context, response).map(item => item.text).join("\n"))) };
}
export function pendingSpeech(context: OverlayState, position = "all") {
  const session = context.current;
  if (!session) return { markup: "", ids: new Set<string>(), texts: [] as string[] };
  const responses = context.historyPager.page(session, "responses", { view: "overlay" });
  if (responses.hasNewer) return { markup: "", ids: new Set<string>(), texts: [] as string[] };
  const assigned = new Set(session.responses.flatMap(response => associated(context, response).map(item => item.id)));
  const page = context.historyPager.page(session, "transcripts", { view: speechHistoryView });
  const available = page.items.filter(item => !assigned.has(item.id));
  const requestIds = new Set(context.activeAnswerRequest?.sourceTranscriptIds || available
    .filter(item => context.liveQuestion && normalized(item.text) === normalized(context.liveQuestion)).map(item => item.id));
  const loose = position === "request" ? available.filter(item => requestIds.has(item.id)) :
    position === "unanswered" ? available.filter(item => !requestIds.has(item.id)) : available;
  const navigation = renderHistoryNavigation(null, page, "transcripts", speechHistoryView);
  const partials = session.state === "active" && position !== "request" ? [...context.partialTranscripts?.entries() || []]
    .filter(([, item]) => item.sessionId === session.id && item.text.trim()) : [];
  const turns = speechTurns([...loose, ...partials.map(([id, item]) => ({
    id: "partial:" + id, text: item.text, who: item.who, source: "audio",
    ...(item.utteranceId ? { utteranceId: item.utteranceId } : {}),
    time: context.time(Math.floor(item.relativeMs / 1000)), pending: true,
  }))], position === "request");
  return {
    markup: (navigation && position !== "request" ? `<div data-chat-key="speech-navigation">${navigation}</div>` : "") +
      renderTurns(context, turns),
    ids: new Set(loose.map(item => item.id)), texts: turns.filter(turn => !turn.pending).map(turn => normalized(turn.text)),
  };
}
export function hasOverlaySpeech(context: Pick<OverlayState, "current" | "partialTranscripts">) {
  const session = context.current;
  return Boolean(session?.transcripts.length || (session?.state === "active" &&
    [...context.partialTranscripts?.values() || []].some(item => item.sessionId === session.id && item.text.trim())));
}
export function liveSpeechQuestionShown(context: OverlayState, pending = pendingSpeech(context)) {
  const ids = context.activeAnswerRequest?.sourceTranscriptIds;
  return ids?.length ? ids.every(id => pending.ids.has(id)) && normalized(context.liveQuestion) ===
    normalized(ids.map(id => context.current?.transcripts.find(item => item.id === id)?.text || "").join("\n")) :
    Boolean(context.liveQuestion && pending.texts.includes(normalized(context.liveQuestion)));
}
