import type { PanelState } from "./state.js";

import { heading } from "./controls.js";
export function renderKeyboardSettings(s: PanelState) {
  const groups: [string, [string, string, string][]][] = [
    [
      "Geral",
      [
        ["toggle", "Mostrar ou ocultar o Orvunia", "keyboard"],
        ["ask", "Perguntar sobre sua tela ou conversa", "chat"],
        ["clear", "Limpar a conversa atual", "trash"],
        ["pause", "Pausar ou retomar a sessão", "mic"],
      ],
    ],
    [
      "Janela",
      [
        ["up", "Mover a janela para cima", "up"],
        ["down", "Mover a janela para baixo", "down"],
        ["left", "Mover a janela para a esquerda", "back"],
        ["right", "Mover a janela para a direita", "arrow"],
      ],
    ],
    [
      "Rolagem",
      [
        ["scrollUp", "Rolar a resposta para cima", "up"],
        ["scrollDown", "Rolar a resposta para baixo", "down"],
      ],
    ],
    [
      "Outros atalhos",
      [
        ["capture", "Capturar tela ou janela", "screen"],
        ["camera", "Mover para perto da câmera", "camera"],
        ["cursor", "Mover para o cursor", "cursor"],
        ["clickthrough", "Passar cliques pela janela", "cursor"],
      ],
    ],
  ];
  return `${heading("Atalhos de teclado", "Clique em um atalho e pressione a combinação que deseja usar.")}<div class="keyboard-shortcut-groups">${groups
    .map(
      ([name, items]) =>
        `<section class="keyboard-shortcut-group"><h3>${name}</h3>${items
          .map(([key, title, i]) => {
            const value = s.desktop.settings.shortcuts[key],
              tokens = (value || "Desktop")
                .replaceAll("CommandOrControl", "Ctrl")
                .split("+")
                .map(
                  (v) =>
                    ({
                      Up: "↑",
                      Down: "↓",
                      Left: "←",
                      Right: "→",
                      Space: "Espaço",
                      Enter: "↵",
                    })[v] || v,
                );
            return `<label class="keyboard-shortcut-row">${s.icon(i, 17)}<span>${title}${s.desktop.failedShortcuts.includes(key) ? "<small>Ocupado por outro aplicativo</small>" : ""}</span><span class="shortcut-control" data-component="shortcut-recorder" title="Clique duas vezes para restaurar o atalho padrão" data-shortcut-reset="${key}"><span class="shortcut-keycaps">${tokens.map((v) => `<kbd>${s.esc(v)}</kbd>`).join("")}</span><span class="shortcut-capture-prompt">PRESSIONE O ATALHO / 2 CLIQUES PARA REDEFINIR</span><input class="shortcut-input" data-shortcut="${key}" data-shortcut-reset="${key}" readonly aria-label="${title}" value="${s.esc(value || s.translate("Somente no desktop"))}"></span></label>`;
          })
          .join("")}</section>`,
    )
    .join("")}</div>`;
}
