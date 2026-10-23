import type { PanelState } from "./state.js";
import type { PanelResponse, DisplayPage } from "./data.js";
import { historyTotal } from "../history/view.js";
export function renderHistoryNavigation(
  s: unknown,
  page: DisplayPage<unknown> | null | undefined,
  kind: string,
  view: string,
) {
  if (!page || (!page.hasOlder && !page.hasNewer)) return "";
  const action = (direction: string) =>
    `history-page:${kind}|${view}|${direction}`;
  const older =
    kind === "transcripts"
      ? "Mostrar falas anteriores"
      : kind === "captures"
        ? "Mostrar capturas anteriores"
        : "Mostrar respostas anteriores";
  return `<nav class="history-pagination" aria-label="Histórico da sessão"><button type="button" data-action="${action("older")}" ${page.hasOlder ? "" : "disabled"}>${older}</button><span data-i18n-skip>${page.items.length}</span><button type="button" data-action="${action("newer")}" ${page.hasNewer ? "" : "disabled"}>Próximos</button>${page.hasNewer ? `<button type="button" data-action="${action("latest")}" class="history-latest">Mais recentes <small data-i18n-skip>${page.newerCount}</small></button>` : ""}</nav>`;
}
export function sessionResponsePage(
  s: PanelState,
  responses: PanelResponse[],
  session = s.current,
  view = "panel-conversation",
) {
  if (s.historyPager && session) {
    const page = s.historyPager.page(session, "responses", {
      view,
      filter: (response) => response.action !== "recap",
    });
    return {
      responses: page.items,
      load: renderHistoryNavigation(s, page, "responses", view),
      page,
    };
  }
  const requested = Number(s.responseWindowSize),
    size =
      Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 20,
    older =
      Math.max(0, responses.length - size) +
      Math.max(
        0,
        historyTotal(session, "responses") - (session?.responses?.length || 0),
      );
  return {
    responses: responses.slice(-Math.max(1, size)),
    page: undefined,
    load: older
      ? `<button class="session-response-load" data-action="coding-load-older"><span>Mostrar respostas anteriores</span><small data-i18n-skip>${Math.min(20, older)}</small></button>`
      : "",
  };
}
