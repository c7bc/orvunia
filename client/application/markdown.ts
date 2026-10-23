import type { ApplicationState } from "./model.js";
import { createCodeCopy } from "../clipboard/button.js";
export type MarkdownPlatform = {
  parse(text: string): string;
  sanitize(
    text: string,
    options: { FORBID_TAGS: string[]; FORBID_ATTR: string[] },
  ): string;
  highlight(element: HTMLElement): void;
  copy(text: string): Promise<unknown>;
};
export function createApplicationMarkdown(ports: {
  state: ApplicationState;
  document: Document;
  platform: MarkdownPlatform;
  history: { isPreserved(element: Element): boolean };
  reviewHistory: { isPreserved(element: Element): boolean };
  toast(message: string): void;
  translate?(message: string): string;
}) {
  const { document, platform } = ports;
  const copies = createCodeCopy({ document, copy: (text) => platform.copy(text),
    response: id => ports.state.current?.responses.find(response => response.id === id)?.text,
    scope: () => ports.state.current?.id || "",
    translate: ports.translate ?? ((text) => text), toast: ports.toast,
    schedule: (callback, delay) => document.defaultView?.setTimeout(callback, delay) });
  const markdown = (text: string) =>
    platform.sanitize(platform.parse(text || ""), {
      FORBID_TAGS: [
        "img",
        "iframe",
        "style",
        "form",
        "input",
        "video",
        "audio",
      ],
      FORBID_ATTR: ["style"],
    });
  function decorateContent(root: ParentNode = document) {
    for (const code of root.querySelectorAll<HTMLElement>(".markdown pre code"))
      if (!code.dataset.highlighted) platform.highlight(code);
    copies.decorate(root);
  }
  function decorate() {
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-markdown]",
    )) {
      if (
        ports.history.isPreserved(element) ||
        ports.reviewHistory.isPreserved(element)
      )
        continue;
      const response = ports.state.current?.responses.find(
        (item) => item.id === element.dataset.markdown,
      );
      if (response) element.innerHTML = markdown(response.text);
    }
    decorateContent();
  }
  function scroll() {
    const area =
      document.querySelector<HTMLElement>("#answer-area") ||
      document.querySelector<HTMLElement>(".session-review-messages") ||
      document.querySelector<HTMLElement>(".detail-chat-log");
    if (area) area.scrollTop = area.scrollHeight;
  }
  return { markdown, decorate, decorateContent, scroll };
}
