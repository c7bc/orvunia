import type { ModeBase } from "../panel/data.js";
export const desktopActions: Record<ModeBase, [string, string, string][]> = {
  recruiter: [
    ["assist", "O que devo dizer?", "spark"],
    ["star", "Estruturar em STAR", "file"],
    ["followup", "Perguntas de acompanhamento", "chat"],
    ["recap", "Resumir conversa", "history"],
    ["email", "E-mail de acompanhamento", "file"],
  ],
  technical: [
    ["assist", "Resolver problema", "code"],
    ["hint", "Me dê uma pista", "spark"],
    ["debug", "Encontrar o bug", "search"],
    ["design", "Desenhar arquitetura", "screen"],
    ["tests", "Criar testes", "check"],
    ["optimize", "Otimizar solução", "spark"],
    ["explain", "Explicar passo a passo", "chat"],
  ],
};
