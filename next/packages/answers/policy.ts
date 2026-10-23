import { interviewVoiceInstructions } from "../prompts/roles.ts";

export { foundationInstructions, spokenContextInstructions } from "../prompts/foundation.ts";
export { baseModeInstructions } from "../prompts/roles.ts";
export { calibrationExample } from "../prompts/examples.ts";

export const answerPolicyVersion = "2026-10-20.3";

export const actionInstructions = {
  assist: "Responda à pergunta mais recente conforme o modo selecionado.",
  followup: "Sugira duas perguntas úteis de acompanhamento da conversa.",
  star: "Organize a resposta em Situação, Tarefa, Ação e Resultado.",
  recap: "Resuma a discussão, decisões, dúvidas abertas e próximos passos.",
  custom: "Responda diretamente ao pedido manual conforme o modo selecionado.",
  hint: "Dê uma pista útil sem revelar a solução completa.",
  debug: "Analise defeitos e casos extremos, diagnóstico, correção e verificação.",
  design: "Apresente requisitos, componentes, fluxo de dados, alternativas, falhas e validação.",
  email: "Redija um e-mail conciso de acompanhamento da conversa e seus próximos passos.",
  tests: "Proponha casos de teste relevantes, casos extremos e resultados esperados.",
  optimize: "Otimize a solução e explique alternativas, complexidade de tempo e espaço e validação.",
  explain: "Explique a solução com etapas de implementação, exemplo e invariante principal.",
} as const;

export function deliveryInstructions(output: string, action: keyof typeof actionInstructions): string {
  if (["recap", "email", "followup"].includes(action)) return "";
  return `${interviewVoiceInstructions}\nIdioma selecionado: ${output}.`;
}
