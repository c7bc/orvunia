import type { CommandContext } from "./ports.js";
export async function runHistoryCommands(
  context: CommandContext,
  key: string,
  value: string,
): Promise<boolean> {
  const { state: browser, ports } = context;
  switch (key) {
    case "coding-load-older":
      await ports.moveHistory(
        "responses",
        browser.view === "overlay"
          ? "overlay"
          : browser.reviewChatSessionId
            ? "review-chat"
            : browser.detailTab === "usage"
              ? "panel-usage"
              : "panel-conversation",
        "older",
      );
      return true;
    case "history-transcripts":
      await ports.moveHistory(
        "transcripts",
        browser.view === "overlay"
          ? "overlay-transcripts"
          : "panel-transcripts",
        "older",
      );
      return true;
    case "history-captures":
      await ports.moveHistory("captures", "overlay-captures", "older");
      return true;
    case "history-page": {
      const [kind = "", historyView = "", direction = ""] =
        String(value).split("|");
      if (
        !["responses", "transcripts", "captures"].includes(kind) ||
        ![
          "overlay",
          "review-chat",
          "panel-usage",
          "panel-conversation",
          "panel-transcripts",
          "overlay-transcripts",
          "overlay-chat-transcripts",
          "overlay-captures",
        ].includes(historyView) ||
        !["older", "newer", "latest"].includes(direction)
      )
        return true;
      await ports.moveHistory(kind, historyView, direction);
      return true;
    }
    case "session-index-older":
      await ports.searchSessionHistory(browser.search, true);
      return true;
    case "back":
      await ports.navigateHistory(-1);
      return true;
    case "forward":
      await ports.navigateHistory(1);
      return true;
    case "history-menu": {
      const trigger = ports.document.querySelector(
        `[data-action="history-menu:${ports.escapeSelector(value)}"]`,
      );
      browser.historyMenuAbove = Boolean(
        trigger &&
        trigger.getBoundingClientRect().bottom + 50 >
          ports.window.innerHeight - 8,
      );
      browser.historyMenuId = browser.historyMenuId === value ? null : value;
      ports.render();
      return true;
    }
    case "export":
      await ports.exportSession(value);
      return true;
    case "delete":
      ports.modal(
        "Excluir sessão",
        `<p>Esta sessão, suas respostas, capturas e transcrição serão removidas deste computador.</p><div class="form-footer">${ports.button("Cancelar", "modal-close")}${ports.button("Excluir sessão", `delete-confirm:${value}`, "danger", "trash")}</div>`,
      );
      return true;
    case "delete-confirm":
      if (browser.current?.id === value)
        throw Error("Encerre a sessão atual antes de excluir.");
      await ports.request(`/sessions/${value}`, "DELETE");
      ports.coding.clear(value);
      ports.historyPager.clear(value);
      ports.detailDrafts.delete(value);
      ports.closeModal();
      await ports.sync();
      ports.render();
      return true;
  }
  return false;
}
