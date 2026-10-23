import type { CompatibilityContext } from "./compatibility-types.js";
import { platformMessages } from "../platform/messages.js";
import {
  compatibilityRow,
  compatibilitySelect,
} from "./compatibility-controls.js";
import {
  compatibilityResponseLanguages,
  compatibilityTranscriptionLanguages,
  compatibilityCodeLanguages,
} from "./compatibility-languages.js";
export function renderCompatibilitySettings(context: CompatibilityContext) {
  const {
    settingsTab,
    settings,
    preferences,
    health,
    escape,
    button,
    toggle,
    profileForm,
  } = context;
  const row = (title: string, description: string, control: string) =>
    compatibilityRow(context, title, description, control);
  const select = (
    key: string,
    values: readonly (string | readonly [string, string])[],
    value: string,
  ) => compatibilitySelect(escape, key, values, value);
  const platform = platformMessages(context.uiLocale), managed = context.distribution?.channel === "msix";
  const startupControl = managed ? `<span data-i18n-skip>${button(platform.manage, "manage-startup")}</span>` : toggle("launchAtLogin", settings.launchAtLogin);
  const startupDescription = managed ? `<span data-i18n-skip>${escape(platform.startup)}</span>` : "O aplicativo abre quando você entra no Windows.";
  switch (settingsTab) {
    case "general":
      return `<h2>Geral</h2><p class="subtitle">Seu assistente, do seu jeito.</p>${row("Abrir ao iniciar o Windows", startupDescription, startupControl)}${row("Sugestões automáticas", "Sugestões com base nas novas falas do entrevistador.", toggle("autoAnswer", settings.autoAnswer))}${row("Incluir tela ao perguntar", "Atualiza a captura da fonte escolhida antes de cada resposta.", toggle("autoScreen", settings.autoScreen))}<div class="divider"></div><h2>Conexão</h2>${row("OpenAI", health.keyConfigured ? `Credencial carregada no servidor · ${health.keySource}` : "A chave não foi encontrada no ambiente configurado.", '<span class="badge">' + (health.keyConfigured ? "Conectada" : "Pendente") + "</span>")}${row("Geração de respostas", escape(health.models?.response || "—"), "")}${row("Transcrição", escape(health.models?.transcription || "—"), "")}`;
    case "audio":
      return `<h2>Áudio</h2><p class="subtitle">Canais separados para você e para o entrevistador.</p>${row("Microfone", "Sua voz aparece como “Eu”.", '<select id="microphone" aria-label="Microfone"><option value="default">Padrão do sistema</option></select>')}${row("Áudio do computador", "A fala da reunião aparece como “Entrevistador”.", toggle("systemAudio", settings.systemAudio))}${row("Transcrição em tempo real", "Mostra as palavras enquanto a pessoa fala. Desative para usar trechos gravados.", toggle("realtime", settings.realtime))}${row("Intervalo do modo compatível", "Trechos menores chegam antes; trechos maiores preservam mais contexto.", `<select data-desktop-select="chunkSeconds"><option value="3" ${settings.chunkSeconds === 3 ? "selected" : ""}>3 segundos</option><option value="5" ${settings.chunkSeconds === 5 ? "selected" : ""}>5 segundos</option><option value="8" ${settings.chunkSeconds === 8 ? "selected" : ""}>8 segundos</option></select>`)}<div class="notice">A escuta começa quando você clica em “Ouvir” na janela da sessão. Escolha uma tela para habilitar o áudio do computador.</div>${button("Atualizar microfones", "devices", "", "mic")}`;
    case "language":
      return `<h2>Idiomas</h2><p class="subtitle">Escolha separadamente como ouvir, responder e escrever código.</p>${row(
        "Respostas",
        "Idioma de todas as novas respostas.",
        select("output", compatibilityResponseLanguages, preferences.output),
      )}${row(
        "Transcrição",
        "Idioma esperado no áudio.",
        select("audio", compatibilityTranscriptionLanguages, preferences.audio),
      )}${row("Código", "Linguagem das soluções técnicas.", select("code", compatibilityCodeLanguages, preferences.code))}`;
    case "shortcuts": {
      const names = {
        toggle: "Mostrar / ocultar",
        ask: "Pedir resposta",
        capture: "Capturar tela",
        clear: "Limpar respostas",
        camera: "Perto da câmera",
        cursor: "Mover para o cursor",
        clickthrough: "Passar cliques pela janela",
        up: "Mover para cima",
        down: "Mover para baixo",
        left: "Mover para a esquerda",
        right: "Mover para a direita",
        scrollUp: "Rolar resposta para cima",
        scrollDown: "Rolar resposta para baixo",
        pause: "Pausar / retomar",
      };
      return `<h2>Atalhos globais</h2><p class="subtitle">Funcionam com outro aplicativo em foco. Clique em um campo e pressione a combinação.</p>${Object.entries(
        names,
      )
        .map(([key, title]) =>
          row(
            title,
            context.failedShortcuts.includes(key)
              ? "Atalho ocupado por outro aplicativo."
              : "",
            `<input class="shortcut-input" data-shortcut="${key}" readonly aria-label="${title}" value="${escape(settings.shortcuts[key] || "Somente no desktop")}">`,
          ),
        )
        .join("")}`;
    }
    case "privacy":
      return `<h2>Privacidade da janela</h2><p class="subtitle">Controles nativos para uma sobreposição discreta.</p>${row("Proteção contra captura", "Solicita ao Windows excluir as janelas do Orvunia das capturas compatíveis.", toggle("protected", settings.protected))}${row("Evitar roubar foco", "Mantém o teclado no aplicativo atual. Desative para digitar no assistente.", toggle("noFocus", settings.noFocus))}${row("Passar cliques pela janela", "Interaja com o aplicativo que está atrás. Use o atalho para voltar.", toggle("clickthrough", settings.clickthrough))}<div class="notice">A proteção depende do método de captura usado pelo outro aplicativo. Não garante invisibilidade em todos os gravadores, nem oculta o processo do Gerenciador de Tarefas.</div>${row("Armazenamento", "Histórico e referências são salvos localmente. Áudio, contexto e capturas usados numa solicitação são enviados à OpenAI. A chave permanece no servidor.", "")}`;
    case "appearance":
      return `<h2>Aparência e posição</h2><p class="subtitle">Coloque as respostas onde você já está olhando.</p>${row("Tema do painel", "A janela flutuante usa o tema escuro translúcido.", `<select data-desktop-select="theme"><option value="system" ${settings.theme === "system" ? "selected" : ""}>Sistema</option><option value="light" ${settings.theme === "light" ? "selected" : ""}>Claro</option><option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Escuro</option></select>`)}${row("Opacidade da janela", `${settings.opacity}%`, `<input type="range" min="45" max="100" value="${settings.opacity}" data-opacity aria-label="Opacidade">`)}${row("Perto da câmera", "Centraliza o assistente junto ao topo do monitor.", button("Posicionar", "camera", "", "camera"))}${row("Na posição do cursor", "Move a janela para onde você está trabalhando.", button("Mover", "cursor", "", "move"))}<div class="notice">Arraste a barra superior ou use os atalhos para mover a janela. A posição é lembrada. Esse comportamento corresponde à janela móvel anunciada como “Follows your eyes”; não utiliza rastreamento ocular.</div>`;
    case "profile":
      return profileForm(false);
  }
}
