import type { OverlayState } from "./state.js";
import { renderHistoryNavigation } from "../panel/paging.js";
export function renderOverlayTranscript(context: OverlayState) {
  const { current, historyPager, esc, icon, time } = context;

  const page = current
    ? historyPager.page(current, "transcripts", { view: "overlay-transcripts" })
    : null;
  return `${renderHistoryNavigation(null, page, "transcripts", "overlay-transcripts")}<div id="transcript-lines" data-history-list="${esc(current?.id)}|overlay-transcripts" data-history-page="${esc(page?.key || "")}">${page?.items.length ? page.items.map((t) => `<div class="transcript-line"><div class="who">${icon(t.who === "Eu" ? "mic" : "volume", 12)}${esc(t.who)}<small>${esc(t.time)}</small></div><p>${esc(t.text)}</p></div>`).join("") : '<div class="empty">As falas aparecem aqui quando a escuta está ativa.<br>Você também pode adicionar uma pergunta manualmente.</div>'}</div><div id="partial-transcripts"></div><form id="transcript-form" class="transcript-form"><textarea name="text" rows="2" maxlength="16000" required aria-label="Adicionar fala" placeholder="Adicionar fala à transcrição…"></textarea><div class="flex"><select name="who" aria-label="Quem falou"><option>Entrevistador</option><option>Eu</option></select><button type="submit" class="btn">Adicionar fala</button></div></form>`;
}
