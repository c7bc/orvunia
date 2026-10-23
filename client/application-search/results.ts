import type { PanelSession } from "../panel/data.js";
import { normalizeSearch } from "../history-application/command-search.js";

export interface SearchMarkup {
  icon(name: string, size: number): string;
  escape(value: string): string;
  translate(value: string): string;
  date(value: string): string;
}
type Command = readonly [string, string, string, string?];
const commands: readonly Command[] = [
  ["home", "Ver sessões", "history"],
  ["start", "Iniciar Orvunia", "mic"],
  ["prompts", "Gerenciar modos", "modes"],
  ["general", "Configurações gerais", "settings", "settings"],
  ["calendar", "Agenda", "calendar", "settings"],
  ["shortcuts", "Atalhos de teclado", "keyboard", "settings"],
  ["profile", "Perfil", "user", "settings"],
  ["security", "Segurança", "shield", "settings"],
  ["language", "Idiomas", "language", "settings"],
  ["billing", "Plano e uso", "card", "settings"],
  ["providers", "Provedores de IA", "spark", "settings"],
  ["changelog", "Notas da versão", "file"],
  ["help", "Central de ajuda", "help"],
];
export function renderSearchResults(
  markup: SearchMarkup,
  items: PanelSession[],
  query: string,
) {
  const needle = normalizeSearch(query.trim());
  const matches = (text: string) => normalizeSearch(text).includes(needle);
  const selected = commands.filter(([key, label]) =>
    !needle
      ? !["prompts", "changelog", "help", "providers"].includes(key)
      : matches(label) || matches(markup.translate(label)),
  );
  const group = (items: Command[]) =>
    items
      .map(
        ([key, label, icon, section]) =>
          `<button data-search-page="${key}" ${section ? 'data-search-settings="true"' : ""}>${markup.icon(icon, 17)}<span>${label}</span>${key === "start" ? "<kbd>↵</kbd>" : ""}</button>`,
      )
      .join("");
  const actions = selected.filter((item) => !item[3]);
  const settings = selected.filter((item) => item[3]);
  return (
    (actions.length ? `<p>Ações</p>${group(actions)}` : "") +
      (settings.length ? `<p>Configurações</p>${group(settings)}` : "") +
      (items.length
        ? `<p>Sessões</p>${items.map((session) => `<button data-search-session="${markup.escape(session.id)}">${markup.icon(session.mode === "technical" ? "code" : "chat", 17)}<span data-i18n-skip>${markup.escape(session.title)}</span><small>${markup.date(session.date)}</small></button>`).join("")}`
        : "") || '<div class="empty">Nenhum resultado.</div>'
  );
}
