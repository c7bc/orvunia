import type { OverlayState } from "./state.js";
import type { ModeBase } from "../panel/data.js";
import { renderAudioLabel } from "./status.js";
export function renderOverlayMenu(context: OverlayState, mode: ModeBase) {
  const {
    time,
    duration,
    select,
    modes,
    modeName,
    current,
    selectedMode,
    icon,
    audio,
    desktop,
    actions,
    library,
    esc,
  } = context;

  return `<div class="overlay-menu" role="menu"><div class="overlay-menu-caption">Sessão <span id="elapsed">${time(duration())}</span></div><div class="overlay-mode-row"><label for="mode">Modo</label>${select(
    "mode",
    modes.map((m) => [m.id, modeName(m.id)]),
    current?.modeId || selectedMode,
  )}</div><button data-action="listen">${icon(audio.running ? "pause" : "mic", 16)}${audio.running ? "Pausar escuta" : "Ouvir conversa"}<small>${renderAudioLabel(context)}</small></button><button data-action="auto">${icon("spark", 16)}Respostas automáticas<small>${desktop.settings.autoAnswer ? "Ativadas" : "Desativadas"}</small></button><button data-action="capture">${icon("screen", 16)}Capturar tela ou janela</button><button data-action="capture-region">${icon("screen", 16)}Capturar região</button><button data-tab="answers">${icon("chat", 16)}Respostas</button><button data-tab="transcripts">${icon("audio", 16)}Transcrição <small>${current?.transcripts.length || 0}</small></button><button data-tab="context">${icon("file", 16)}Contexto e capturas <small>${current?.captures.length || 0}</small></button><hr>${actions[
    mode
  ]
    .filter(
      ([key]) =>
        !(
          mode === "technical"
            ? ["assist", "hint", "debug", "design"]
            : ["assist", "followup", "recap"]
        ).includes(key),
    )
    .map(
      ([key, title, i]) =>
        `<button data-ask="${key}">${icon(i, 16)}${title}</button>`,
    )
    .join("")}${library.prompts
    .filter((p) => p.mode === mode)
    .map(
      (p) =>
        `<button data-custom="${p.id}">${icon("spark", 16)}${esc(p.title)}</button>`,
    )
    .join(
      "",
    )}<hr><button data-action="attach-image">${icon("attach", 16)}Adicionar imagem</button><button data-action="clipboard">${icon("file", 16)}Colar contexto</button><button data-action="clear">${icon("trash", 16)}Limpar contexto</button><button data-action="settings">${icon("settings", 16)}Configurações</button>${current ? `<button data-action="${current?.state === "paused" ? "pause" : "pause"}">${icon(current?.state === "paused" ? "play" : "pause", 16)}${current?.state === "paused" ? "Retomar sessão" : "Pausar sessão"}</button><button data-action="end">${icon("stop", 16)}Encerrar sessão</button>` : ""}</div>`;
}
