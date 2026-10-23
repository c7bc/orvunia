import type { PanelState } from "./state.js";
import { heading, setting } from "./controls.js";
import { platformMessages } from "../platform/messages.js";

export function renderGeneralSettings(s: PanelState) {
  const { desktop, esc, button, toggle } = s,
    d = desktop.settings;
  const managed = desktop.distribution?.channel === "msix", platform = platformMessages(s.uiLocale);
  return `${heading("Geral", "Personalize como o Orvunia funciona para você")}
<div class="preferences-group main-preferences">
${setting(s, "Versão do Orvunia", `Você está usando o Orvunia ${esc(desktop.version || "4.5.0")}`, managed ? `<span data-i18n-skip>${button(platform.updates, "check-updates")}</span>` : '<button class="btn version-update-button" data-action="check-updates">Verificar atualizações</button>', "download")}
${setting(s, "Proteção de captura", d.protected ? "A janela é excluída das capturas compatíveis do Windows." : "A janela está visível nas capturas de tela.", toggle("protected", d.protected), "eye")}
${setting(s, "Assistente entre reuniões", "Converse com o Orvunia fora das suas reuniões.", toggle("ambientChat", d.ambientChat), "headphones")}
${setting(s, "Tema", "Use o tema claro, escuro ou o mesmo do sistema.", `<select data-desktop-select="theme" aria-label="Tema"><option value="system" ${d.theme === "system" ? "selected" : ""}>Sistema</option><option value="light" ${d.theme === "light" ? "selected" : ""}>Claro</option><option value="dark" ${d.theme === "dark" ? "selected" : ""}>Escuro</option></select>`, d.theme === "light" ? "sun" : "palette")}
</div>
<section class="audio-source-settings">
${heading("Configurações de áudio", "Prepare sua entrada de áudio antes de entrar em uma chamada")}
<div class="preferences-group audio-preferences">
${setting(s, "Iniciar escuta com a sessão", "Use automaticamente as fontes habilitadas abaixo ao iniciar ou retomar a sessão.", toggle("autoListen", d.autoListen), "play")}
${setting(s, "Transcrever minha voz", "Inclua o microfone na escuta. Suas falas confirmadas são salvas como “Eu” na transcrição.", toggle("transcribeMicrophone", d.transcribeMicrophone !== false), "mic")}
${setting(s, "Áudio do computador", "Ouça a chamada separadamente do microfone.", toggle("systemAudio", d.systemAudio), "volume")}
${setting(s, "Pausa antes de responder", "Espere este tempo sem novas falas antes da resposta automática. A transcrição continua ativa.", `<select data-desktop-select="answerPauseSeconds" aria-label="Pausa antes de responder">${Array.from({ length: 16 }, (_, seconds) => `<option value="${seconds}" ${(d.answerPauseSeconds ?? 1) === seconds ? "selected" : ""}>${seconds === 0 ? "Assim que a fala for confirmada" : `${seconds} s`}</option>`).join("")}</select>`, "audio")}
</div>
<div class="microphone-source-card"><div class="microphone-source-copy"><h3>Fonte do áudio do computador</h3><div>${s.icon("volume", 13)}<select id="system-audio-device" data-desktop-select="systemAudioDevice" aria-label="Fonte do áudio do computador"><option value="default:multimedia">Padrão do sistema</option></select></div></div></div>
<p class="audio-settings-hint" data-system-audio-hint role="status">Selecione a saída em que você ouve a entrevista. Essa fonte é independente da captura de tela.</p>
<p class="audio-settings-hint">O Windows pode usar saídas diferentes para chamadas e outros sons. Escolha o mesmo dispositivo usado no WhatsApp, Meet ou outro aplicativo.</p>
<div class="microphone-source-card"><div class="microphone-source-copy"><h3>Fonte do microfone</h3><div>${s.icon("mic", 13)}<select id="microphone" aria-label="Microfone"><option value="default">Padrão do sistema</option></select></div></div>${button("Testar microfone", "microphone-test")}</div>
<p class="audio-settings-hint" data-microphone-hint role="status">Sua voz será capturada pelo microfone selecionado. O áudio do computador é uma fonte separada.</p>
<p class="audio-settings-hint">O teste do microfone só verifica o dispositivo: não transcreve nem salva falas.</p>
<p class="audio-settings-hint">A escuta envia áudio aos provedores configurados. Uma fala só aparece como salva após confirmação do servidor.</p>
</section>
<details class="advanced-settings"><summary>${heading("Avançado", "Configure outros recursos do Orvunia")}<span>⌃</span></summary><div class="preferences-group">
${setting(s, "Provedores de IA", "Configure seus modelos de resposta e transcrição.", button("Configurar", "providers"), "spark")}
${setting(s, "Transcrição em tempo real", "Veja as falas enquanto a conversa acontece.", toggle("realtime", d.realtime), "audio")}
${setting(s, "Usar contexto da tela", "Inclua uma nova captura antes de pedir uma resposta.", toggle("autoScreen", d.autoScreen), "screen")}
${setting(s, "Respostas automáticas", "Sugestões com base nas novas falas do entrevistador.", toggle("autoAnswer", d.autoAnswer), "spark")}
${setting(s, "Evitar roubar foco", "Mantenha o teclado no aplicativo em que está trabalhando.", toggle("noFocus", d.noFocus), "cursor")}
${setting(s, "Passar cliques", "Interaja com o que está atrás da janela flutuante.", toggle("clickthrough", d.clickthrough), "cursor")}
${setting(s, "Abrir ao iniciar o Windows", managed ? `<span data-i18n-skip>${esc(platform.startup)}</span>` : "Tenha o assistente pronto ao entrar no computador.", managed ? `<span data-i18n-skip>${button(platform.manage, "manage-startup")}</span>` : toggle("launchAtLogin", d.launchAtLogin), "play")}
${setting(s, "Opacidade da superfície", `${d.opacity}% — o texto permanece opaco e nítido.`, `<input type="range" min="45" max="100" value="${d.opacity}" data-opacity aria-label="Opacidade">`, "sun")}
${setting(s, "Posição da janela", "Mova para perto da câmera ou para o cursor.", `${button("Câmera", "camera")}${button("Cursor", "cursor")}`, "move")}
</div>${s.renderGazeSettings?.() || ""}</details>`;
}
