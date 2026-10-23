import type { PanelState } from "./state.js";

import { settingsBody } from "./settings.js";
import { renderModeCatalog } from "./modes.js";
import { modes } from "./modes.js";
export const settingsTabs: [string, string, string][] = [
  ["general", "Geral", "settings"],
  ["calendar", "Agenda", "calendar"],
  ["shortcuts", "Atalhos", "keyboard"],
  ["profile", "Perfil", "user"],
  ["security", "Segurança", "shield"],
  ["language", "Idioma", "language"],
  ["billing", "Plano e uso", "card"],
];
export function dialog(s: PanelState, kind: string) {
  const { icon, ib, esc } = s,
    settings = kind === "settings",
    cloud = s.isCloud || s.accountLocation === "Orvunia Cloud";
  const sidebar = settings
    ? `<nav aria-label="Configurações">${settingsTabs.map(([key, label, i]) => `<button class="dialog-nav ${s.settingsTab === key ? "selected" : ""}" data-settings-tab="${key}" ${s.settingsTab === key ? 'aria-current="page"' : ""}>${icon(["calendar", "keyboard"].includes(i) ? i : i + "-solid", 20)}<span>${label}</span></button>`).join("")}</nav><h3>Suporte</h3><nav><button class="dialog-nav" data-page="changelog">${icon("file-solid", 20)}Notas da versão</button><button class="dialog-nav" data-page="help">${icon("lifebuoy-solid", 20)}Central de ajuda</button><button class="dialog-nav" data-page="help">${icon("help-solid", 20)}Ajuda e diagnóstico</button></nav><div class="grow"></div><div class="dialog-bottom-actions">${cloud ? `<button class="dialog-nav" data-action="account-signout">${icon("exit", 20)}Sair da conta</button>` : ""}<button class="dialog-nav" data-action="quit-app">${icon("frown-solid", 20)}Sair do Orvunia</button></div>`
    : `<button class="mode-new-button" data-action="mode-new">${icon("plus", 16)}Novo modo</button><nav class="custom-mode-navigation" aria-label="Seus modos">${s.modes.map((m) => `<button class="dialog-nav ${!s.modeCatalog && s.modeEditor === m.id ? "selected" : ""}" data-edit-mode="${esc(m.id)}">${icon("file", 17)}<span data-i18n-skip>${esc(s.modeName(m.id))}</span>${s.selectedMode === m.id ? `<span class="mode-active-mark" data-motion-badge="${esc(m.id)}" title="Modo ativo">${icon("check", 11)}</span>` : ""}</button>`).join("")}</nav><div class="grow"></div><div class="mode-sidebar-footer"><button class="dialog-nav mode-template-link ${s.modeCatalog ? "selected" : ""}" data-action="mode-catalog">${icon("mode-templates-solid", 18)}Modelos do Orvunia</button></div>`;
  return `<div class="studio-dialog-backdrop" data-dialog-backdrop data-motion-dialog="${kind}"><section class="studio-dialog ${settings ? "settings-dialog" : "modes-dialog"}" role="dialog" aria-modal="true" aria-label="${settings ? "Configurações" : "Gerenciar modos"}"><aside class="dialog-sidebar" data-component="dialog-sidebar"><div class="dialog-close">${ib("close", "dialog-close", "Fechar")}</div>${sidebar}</aside><div class="dialog-content" ${!settings ? `data-motion-editor="${s.modeCatalog ? "catalog" : esc(s.modeEditor)}"` : ""} ${settings ? `data-settings-view="${esc(s.settingsTab)}"` : ""}>${settings ? settingsBody(s) : s.modeCatalog ? renderModeCatalog(s) : modes(s)}</div></section></div>`;
}
