import type { CompatibilityContext } from "./compatibility-types.js";
export function compatibilityRow(
  context: Pick<CompatibilityContext, "icon">,
  title: string,
  description: string,
  control: string,
) {
  const symbol = /Idioma|Respostas|Código|Transcrição/.test(title)
    ? "language"
    : /Atalho|Mostrar|Mover|Rolar|Pedir|Capturar|Limpar|Pausar|cima|baixo|direita|esquerda/.test(
          title,
        )
      ? "keyboard"
      : "settings";
  return `<div class="preference-row"><div class="preference-copy"><div class="preference-icon">${context.icon(symbol, 24)}</div><div><h3>${title}</h3><p>${description}</p></div></div><div class="preference-control">${control}</div></div>`;
}
export function compatibilitySelect(
  escape: (value: unknown) => string,
  key: string,
  values: readonly (string | readonly [string, string])[],
  selected: string,
) {
  return `<select data-pref="${key}" aria-label="${key}">${values
    .map((item) => {
      const [value, label] = typeof item === "string" ? [item, item] : item;
      return `<option value="${escape(value)}" ${key === "mode" ? "data-i18n-skip" : ""} ${value === selected ? "selected" : ""}>${escape(label)}</option>`;
    })
    .join("")}</select>`;
}
