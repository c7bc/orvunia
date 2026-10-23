import type { PanelState } from "./state.js";
import { renderGeneralSettings } from "./general.js";

import { heading } from "./controls.js";
import { setting } from "./controls.js";
import { renderLanguageSettings } from "./language.js";
import { renderKeyboardSettings } from "./keyboard.js";
export function settingsBody(s: PanelState) {
  const { settingsTab, desktop, button, toggle, health, esc } = s,
    d = desktop.settings;
  switch (settingsTab) {
    case "providers":
      return (
        s.renderProviderSettings?.() ||
        heading(
          "Provedores de IA",
          "Configure seus modelos de resposta e transcrição.",
        )
      );
    case "general":
      return renderGeneralSettings(s);
    case "calendar":
      return `${s.renderCalendarSettings?.() || heading("Agenda", "Conecte uma agenda para acompanhar suas reuniões.")}<details class="calendar-local-options"><summary>Agenda local e arquivos .ics</summary><div class="section-head"><h2>Agenda local</h2>${button("Importar .ics", "calendar-import")}${button("Agendar", "schedule", "", "plus")}</div>${s.agendaView()}</details>`;
    case "shortcuts":
      return renderKeyboardSettings(s);
    case "language":
      return renderLanguageSettings(s);
    case "profile": {
      const content = s.renderAccount?.("profile");
      return (
        content ||
        `${heading("Perfil", "Suas informações e seu contexto profissional")}<div class="profile-identity"><div class="profile-avatar">${esc((s.profile?.name || "Você").slice(0, 1).toUpperCase())}</div><div><h3 ${s.profile?.name ? "data-i18n-skip" : ""}>${esc(s.profile?.name || "Seu perfil")}</h3><p ${s.profile?.role ? "data-i18n-skip" : ""}>${esc(s.profile?.role || "Adicione suas informações abaixo")}</p></div></div>${s.profileForm(false)}`
      );
    }
    case "security": {
      const content = s.renderAccount?.("security");
      return (
        content ||
        `${heading("Segurança", "Controle seus dados e a privacidade da janela")}<div class="preferences-group">${setting(s, "Dados neste computador", "Histórico, contexto e referências ficam salvos localmente.", '<span class="version-badge">Local</span>', "file")}${setting(s, "Provedores de IA", "Áudio e contexto são enviados aos provedores escolhidos.", button("Revisar", "providers"), "shield")}${setting(s, "Exportar dados", "Baixe suas sessões e referências em um arquivo JSON.", button("Exportar", "export-data"), "download")}${setting(s, "Apagar este espaço", "Exclua permanentemente histórico, contexto e modos locais.", button("Apagar dados", "workspace-delete"), "trash")}${setting(s, "Proteção contra captura", "Depende do método de captura do aplicativo que compartilha a tela.", toggle("protected", d.protected), "eye-off")}</div>`
      );
    }
    case "billing":
      return (
        s.renderBillingSettings?.() ||
        heading("Plano e uso", "Configure os provedores de IA para começar.")
      );
    default:
      return `<div class="settings-legacy">${s.settingsContent()}</div>`;
  }
}
