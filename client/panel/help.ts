import type { PanelState } from "./state.js";

import { heading } from "./controls.js";
export function help(s: PanelState) {
  return `<div class="dashboard-container standalone-page help-document"><button class="text-button" data-page="home">← Voltar ao início</button>${heading("Central de ajuda", "Prepare o contexto, abra uma sessão e use os atalhos durante a conversa.")}${s.button("Repetir introdução", "onboarding", "", "play")}<div class="help-steps">${[
    [
      "file",
      "Prepare seu contexto",
      "No menu do perfil, abra Gerenciar modos e adicione seu currículo, projetos e a vaga.",
    ],
    [
      "modes",
      "Escolha um modo",
      "Use Recrutador para conversas ou Entrevista técnica para código, testes e arquitetura.",
    ],
    [
      "mic",
      "Ative a escuta",
      "Na janela flutuante, clique em Ouvir e escolha a tela da reunião para usar o áudio do computador.",
    ],
    [
      "keyboard",
      "Peça uma resposta",
      "Use Ctrl+Enter ou escreva uma pergunta. Ctrl+Shift+S captura a tela.",
    ],
    [
      "move",
      "Mova a janela",
      "Arraste a barra superior ou use Ctrl+Shift+Home para aproximá-la da câmera.",
    ],
    [
      "history",
      "Revise suas notas",
      "Encerre a sessão para consultar as respostas e a transcrição no histórico.",
    ],
  ]
    .map(
      ([i, title, text]) =>
        `<article class="help-step"><div class="preference-icon">${s.icon(i, 24)}</div><div><h3>${title}</h3><p>${text}</p></div></article>`,
    )
    .join("")}</div></div>`;
}
