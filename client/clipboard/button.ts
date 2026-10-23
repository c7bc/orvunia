import { createCopyFeedback } from "./feedback.js";
export function createCodeCopy(ports: {
  document: Document;
  copy(text: string): Promise<unknown>;
  translate(text: string): string;
  toast(text: string): void;
  schedule(callback: () => void, delay: number): unknown;
  response?(id: string): string | undefined;
  scope?(): string;
}) {
  const feedback = createCopyFeedback(ports);
  function decorate(root: ParentNode = ports.document) {
    const blocks = [...ports.document.querySelectorAll<HTMLElement>(".markdown pre")];
    for (const pre of root.querySelectorAll<HTMLElement>(".markdown pre")) {
      const code = pre.querySelector("code");
      if (!code) continue;
      const button = pre.querySelector<HTMLButtonElement>(".copy-code") ?? ports.document.createElement("button");
      button.className = "copy-code";
      if (!button.parentElement) pre.append(button);
      const owner = pre.closest<HTMLElement>("[data-markdown], #live-answer");
      const location = owner?.dataset.markdown || owner?.id || "code";
      const index = owner ? [...owner.querySelectorAll<HTMLElement>("pre")].indexOf(pre) : blocks.indexOf(pre);
      feedback.bind(button, { key: `${ports.scope?.() || ""}:${location}:${index}`,
        text: () => pre.querySelector("code")?.textContent || "", label: "Copiar código", success: "Código copiado.", icon: false });
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-action^="copy:"]')) {
      const id = button.dataset.action!.slice(5);
      if (ports.response?.(id) === undefined) continue;
      feedback.bind(button, { key: `${ports.scope?.() || ""}:response:${id}`,
        text: () => ports.response?.(id) || "", label: "Copiar resposta", success: "Resposta copiada.", icon: true });
    }
    feedback.refresh();
  }
  return { decorate };
}
