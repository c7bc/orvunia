import type { PanelState } from "./state.js";
import { renderAudioStatus } from "../audio-status/render.js";
import type { PanelSession } from "./data.js";
import { renderHistoryNavigation } from "./paging.js";
import { liveSessionTranscript } from "./live.js";
import { liveTranscriptSignature } from "./live.js";
export function renderSessionTranscript(s: PanelState, session: PanelSession) {
  const page = s.historyPager?.page(session, "transcripts", {
    view: "panel-transcripts",
  });
  const known = (page?.items || session.transcripts)
      .map(
        (t) =>
          `<article class="detail-transcript"><div><strong data-i18n-skip>${s.esc(t.who)}</strong><small data-i18n-skip>${s.esc(t.time)}</small></div><p data-i18n-skip>${s.esc(t.text)}</p></article>`,
      )
      .join(""),
    live = liveSessionTranscript(s, session);
  return `<div data-session-transcript="${s.esc(session.id)}">${renderAudioStatus({ ...s, current: session }, s.translate)}${page ? renderHistoryNavigation(s, page, "transcripts", "panel-transcripts") : session.history?.transcripts?.before ? s.button("Mostrar falas anteriores", "history-transcripts") : ""}<div class="session-saved-transcript" data-history-list="${s.esc(session.id)}|panel-transcripts" data-history-page="${s.esc(page?.key || "")}">${known}</div><div data-session-live-transcript="${s.esc(session.id)}" data-live-signature="${s.esc(liveTranscriptSignature(s, session))}">${live}</div><div class="notes-empty" data-transcript-empty ${known || live ? "hidden" : ""}>Nenhuma transcrição nesta sessão.</div></div>`;
}
