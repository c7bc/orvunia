import type { ApplicationState } from "./model.js";
import type { AnswerContext } from "../answers/contracts.js";
import type { AnswerOptions } from "../answers/domain.js";
import { runAnswer } from "../answers/index.js";
import { projectAnswerState } from "./answer-state.js";
export type ApplicationAnswerPorts = Omit<
  AnswerContext,
  "state" | "question" | "focusQuestion" | "paint" | "progress"
> & {
  state: ApplicationState;
  document: Document;
  native: boolean;
  markdown(text: string): string;
  decorateMarkdown?(root: ParentNode): void;
  translate(value: string): string;
  updateSize(): void;
  scroll(): void;
  repositoryAsk?(action: string, question: string | undefined, review: boolean,
    options: AnswerOptions): Promise<boolean>;
};
export function createApplicationAnswer(ports: ApplicationAnswerPorts) {
  const { state, document } = ports;
  const pending = new Set<Promise<void>>();
  let disposed = false;
  const query = <Element extends HTMLElement>(selector: string) =>
    document.querySelector<Element>(selector);
  function paint(text: string) {
    state.chatCollapsed = false;
    ports.updateSize();
    const status = query(".coding-stream-status");
    if (status) status.textContent = ports.translate(state.answerPhase);
    const element = query("#live-answer");
    if (!element) return;
    const area =
      query("#answer-area") ||
      query(".session-review-messages") ||
      query(".detail-chat-log");
    const follow =
      area && area.scrollHeight - area.scrollTop - area.clientHeight < 90;
    element.innerHTML = ports.markdown(text);
    ports.decorateMarkdown?.(element);
    if (follow) ports.scroll();
  }
  const context: AnswerContext = {
    ...ports,
    state: projectAnswerState(state, ports.native),
    question: () => query<HTMLTextAreaElement>("#question")?.value.trim(),
    focusQuestion: () => query<HTMLTextAreaElement>("#question")?.focus(),
    paint,
    progress(text, sessionId) {
      const status = query(".coding-stream-status");
      if (status && state.current?.id === sessionId)
        status.textContent = ports.translate(text);
    },
  };
  function ask(
    action = "custom",
    question?: string,
    review = false,
    options: AnswerOptions = {},
  ) {
    if (disposed || document.body?.inert) return Promise.resolve();
    const operation = (async () => {
      if (ports.repositoryAsk && await ports.repositoryAsk(action, question, review, options)) return;
      await runAnswer(context, action, question, review, options);
    })();
    pending.add(operation);
    const remove = () => pending.delete(operation);
    void operation.then(remove, remove);
    return operation;
  }
  return {
    ask,
    paint,
    context,
    async settle() {
      while (pending.size) await Promise.allSettled([...pending]);
    },
    dispose() {
      disposed = true;
      state.controller?.abort();
    },
  };
}
