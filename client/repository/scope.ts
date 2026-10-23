import { preparationMessage } from "./preparation-messages.js";

export const defaultRepositoryScope = ["src", "test", "tests", "README.md", "package.json"] as const;

export function readRepositoryScope(container: Element | null) {
  const input = container?.querySelector<HTMLTextAreaElement>("[data-repository-scope]");
  return (input?.value ?? defaultRepositoryScope.join("\n"))
    .split(/\r?\n/).map(path => path.trim()).filter(Boolean);
}

export function renderRepositoryScope(ports: {
  locale: string; id: string; escape(value: unknown): string;
}) {
  const esc = ports.escape;
  const t = (key: Parameters<typeof preparationMessage>[1]) => preparationMessage(ports.locale, key);
  return `<details class="repository-scope-options"><summary>${esc(t("advanced"))}</summary>
    <p class="context-note">${esc(t("scopeHint"))}</p>
    <label for="${esc(ports.id)}">${esc(t("scope"))}</label>
    <textarea id="${esc(ports.id)}" name="scope" data-repository-scope rows="5" required data-i18n-skip>${esc(defaultRepositoryScope.join("\n"))}</textarea>
    </details>`;
}
