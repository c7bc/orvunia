import type { PanelSession } from "../panel/data.js";
import type { SearchMarkup } from "./results.js";
import { findSessions } from "../history-application/command-search.js";
import { renderSearchResults } from "./results.js";
export { renderSearchResults } from "./results.js";

export function createSearchPresentation(
  ports: SearchMarkup & {
    document: Pick<Document, "querySelector">;
    sessions(): PanelSession[];
    search(query: string): void;
    modal(title: string, content: string, className: string): unknown;
  },
) {
  function update(query: string, remoteItems?: PanelSession[]) {
    const output =
      ports.document.querySelector<HTMLElement>("#command-results");
    if (!output) return;
    if (remoteItems === undefined) ports.search(query);
    output.innerHTML = renderSearchResults(
      ports,
      remoteItems || findSessions(ports.sessions(), query),
      query,
    );
    ports.document
      .querySelector("#command-results button")
      ?.classList.add("command-selected");
  }
  function open() {
    ports.modal(
      "Buscar",
      `<div class="command-input">${ports.icon("search", 18)}<input id="command-search" maxlength="200" placeholder="Buscar reuniões, contexto e configurações…" autocomplete="off" aria-label="Buscar no espaço"><kbd>Esc</kbd></div><div class="command-results" id="command-results"></div>`,
      "search-dialog",
    );
    update("");
    ports.document.querySelector<HTMLInputElement>("#command-search")?.focus();
  }
  return { open, update };
}
