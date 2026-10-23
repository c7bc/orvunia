import type { PanelState } from "./state.js";

import { heading } from "./controls.js";
import { setting } from "./controls.js";
export const flowLanguages: [string, string][] = [
  ["pt", "Português"],
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["nl", "Nederlands"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["zh", "中文"],
  ["ru", "Русский"],
  ["ar", "العربية"],
  ["hi", "हिन्दी"],
  ["tr", "Türkçe"],
  ["pl", "Polski"],
  ["uk", "Українська"],
  ["he", "עברית"],
  ["id", "Bahasa Indonesia"],
  ["vi", "Tiếng Việt"],
  ["th", "ไทย"],
  ["sv", "Svenska"],
  ["da", "Dansk"],
  ["fi", "Suomi"],
  ["no", "Norsk"],
  ["ro", "Română"],
  ["el", "Ελληνικά"],
  ["cs", "Čeština"],
  ["hu", "Magyar"],
];
export function flowSelect(
  s: PanelState,
  key: string,
  values: (string | [string, string])[],
  value: string,
) {
  return `<select data-pref="${key}" aria-label="${key}">${values
    .map((item) => {
      const [id, label] = Array.isArray(item) ? item : [item, item];
      return `<option value="${s.esc(id)}" ${id === value ? "selected" : ""}>${s.esc(label)}</option>`;
    })
    .join("")}</select>`;
}
export function renderLanguageSettings(s: PanelState) {
  const locale = s.uiLocale || "pt-BR";
  return `${heading("Idioma", "Personalize o idioma do aplicativo e das respostas.")}<div class="preferences-group language-preferences">${setting(s, "Idioma do aplicativo", "O idioma dos menus, botões e configurações.", `<select data-ui-locale aria-label="Idioma do aplicativo"><option value="pt-BR" ${locale === "pt-BR" ? "selected" : ""}>Português</option><option value="en" ${locale === "en" ? "selected" : ""}>English</option><option value="es" ${locale === "es" ? "selected" : ""}>Español</option></select>`, "language")}${setting(
    s,
    "Idioma das respostas",
    "Seu idioma preferido para respostas e notas da IA.",
    flowSelect(
      s,
      "output",
      flowLanguages.map(([id, label]) => [id === "pt" ? "pt-BR" : id, label]),
      s.prefs.output,
    ),
    "chat",
  )}</div><details class="language-code-options"><summary>Transcrição e soluções técnicas</summary><div class="preferences-group">${setting(s, "Idioma da transcrição", "Selecione o idioma falado nas reuniões.", flowSelect(s, "audio", [["auto", "Detectar automaticamente"], ...flowLanguages], s.prefs.audio), "audio")}${setting(s, "Linguagem do código", "A linguagem usada nas novas soluções técnicas.", flowSelect(s, "code", ["TypeScript", "JavaScript", "Python", "Java", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "SQL", "Ruby"], s.prefs.code), "code")}</div></details>`;
}
