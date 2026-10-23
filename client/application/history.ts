import type { ApplicationContext } from "./context.js";
import { createHistoryApplication } from "../history-application/index.js";
import { createCommandSearch } from "../history-application/command-search.js";
import { createRecapPresentation } from "../history-application/presentation.js";
import { createSearchPresentation } from "../application-search/index.js";
import { renderHistory } from "../panel/home.js";
import { mergeHistoryPage } from "../history/merge.js";
import { applicationSession } from "./decoders.js";
import { applicationIndex, applicationHistoryPage } from "./io-boundary.js";
type HistoryContext = Pick<
  ApplicationContext,
  | "state"
  | "environment"
  | "presentation"
  | "request"
  | "historyPager"
  | "modal"
  | "notes"
  | "rendering"
  | "markdown"
  | "answer"
>;
export function createApplicationHistory(context: HistoryContext) {
  const { state, environment, presentation } = context,
    { document, window } = environment;
  function filtered() {
    const list = state.search
      ? state.sessionSearchQuery === state.search
        ? state.sessionSearchItems
        : []
      : state.sessions;
    const before = state.search
      ? state.sessionSearchQuery === state.search
        ? state.sessionSearchBefore
        : null
      : state.sessionIndexBefore;
    return (
      renderHistory(context.rendering.panel(), list) +
      (before
        ? `<button class="session-response-load" data-action="session-index-older">${presentation.escape(environment.translate("Mostrar sessões anteriores"))}</button>`
        : "")
    );
  }
  const recap = createRecapPresentation({
    escape: presentation.escape,
    translate: environment.translate,
    button: presentation.button,
    modal: (...args) => context.modal.modal(...args),
  });
  const history = createHistoryApplication({
    state,
    workspace: () => state.workspaceKey,
    view: () => state.view,
    index: async (path) => applicationIndex(await context.request(path)),
    history: async (path) =>
      applicationHistoryPage(await context.request(path)),
    merge: (session, kind, page) =>
      applicationSession(mergeHistoryPage(session, kind, page)),
    pager: context.historyPager,
    focus() {
      const focused = document.activeElement?.closest<HTMLElement>(
          ".history-pagination button",
        ),
        command = focused?.dataset.action;
      return focused
        ? {
            current: () => document.activeElement === focused,
            restore() {
              if (command)
                document
                  .querySelector<HTMLElement>(
                    `[data-action="${environment.escapeSelector(command)}"]`,
                  )
                  ?.focus({ preventScroll: true });
            },
          }
        : null;
    },
    render: () => context.rendering.render(),
    scrollAnswers: context.markdown.scroll,
    updateSessionResults() {
      const target = document.querySelector("#session-results");
      if (target) target.innerHTML = filtered();
    },
    prepareGenerated: (id) => context.notes.prepareGenerated(id),
    ask: (token) =>
      context.answer.ask(
        "recap",
        "Resuma esta reunião seguindo o modelo de notas do modo.",
        true,
        { applyGenerated: token },
      ),
    presentRecapConfirmation: recap.confirm,
    presentGeneratedFallback: recap.fallback,
  });
  const commandSearch = createCommandSearch({
    workspace: () => state.workspaceKey,
    input: () =>
      document.querySelector<HTMLInputElement>("#command-search")?.value,
    request: async (path) => applicationIndex(await context.request(path)),
    results: (...args) => search.update(...args),
    error: (message) => context.modal.toast(message),
    schedule: (callback, delay) => window.setTimeout(callback, delay),
    cancel: (timer) => window.clearTimeout(timer),
  });
  const search = createSearchPresentation({
    document,
    sessions: () => state.sessions,
    search: (query) => commandSearch.search(query),
    icon: environment.icon,
    escape: presentation.escape,
    translate: environment.translate,
    date: presentation.date,
    modal: (...args) => context.modal.modal(...args),
  });
  return { history, commandSearch, search, filtered };
}
