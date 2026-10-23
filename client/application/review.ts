import type { ApplicationContext } from "./context.js";
import { renderSessionChat } from "../panel/chat.js";
export function createApplicationReview(
  context: Pick<
    ApplicationContext,
    | "state"
    | "environment"
    | "reviewHistoryDom"
    | "modal"
    | "rendering"
    | "coding"
    | "answer"
  >,
) {
  const { state, environment } = context,
    document = environment.document;
  const query = <Element extends HTMLElement>(
    selector: string,
    root: ParentNode = document,
  ) => root.querySelector<Element>(selector);
  function update(): void {
    const host = query("#dialogs .session-review-chat");
    if (!host) return;
    if (state.reviewChatSessionId !== state.current?.id) {
      state.reviewChatSessionId = null;
      context.modal.close();
      return;
    }
    const old = query(".session-review-thread", host),
      field = query<HTMLTextAreaElement>("#session-chat-question", host),
      focused = field === document.activeElement,
      area = query(".session-review-messages", host);
    const follow =
        !area || area.scrollHeight - area.scrollTop - area.clientHeight < 90,
      scroll = area?.scrollTop || 0;
    context.reviewHistoryDom.beforeRender(host);
    if (old) old.outerHTML = renderSessionChat(context.rendering.panel());
    context.reviewHistoryDom.afterRender(host);
    const fresh = query("#session-chat-question", host);
    if (focused && field && fresh) {
      fresh.replaceWith(field);
      field.focus({ preventScroll: true });
    }
    const next = query(".session-review-messages", host);
    if (next) next.scrollTop = follow ? next.scrollHeight : scroll;
    environment.translateUI(host);
    context.coding.views.refreshAll();
  }
  function open(): void {
    if (!state.current) return;
    state.reviewChatSessionId = state.current.id;
    context.rendering.render();
    context.modal.modal(
      "Conversa sobre a reunião",
      renderSessionChat(context.rendering.panel()),
      "session-review-chat",
    );
  }
  async function ask(selector = "#detail-question"): Promise<void> {
    const input = query<HTMLTextAreaElement>(selector),
      question = input?.value.trim();
    if (!question || state.busy || !state.current || !input) return;
    state.detailDrafts.set(state.current.id, "");
    input.value = "";
    if (state.reviewChatSessionId !== state.current.id) open();
    await context.answer.ask("custom", question, true);
  }
  return { update, open, ask };
}
