import { localeFrom } from "../i18n/messages.ts";
const messages = {
  "pt-BR": {
    unknown: "A chamada pode ter sido processada. O agente não vai repetir automaticamente nem apresentar custo desconhecido como zero.",
    provider: "A conexão atual não oferece as ferramentas do repositório ou mudou desde o início. Selecione uma conexão compatível e inicie uma nova pergunta.",
    context: "A autorização, a revisão do repositório ou o histórico mudou. Revise e aprove o contexto novamente.",
    limit: "O agente atingiu o limite desta pergunta. Revise o contexto e faça uma pergunta mais específica.",
    generic: "Não foi possível concluir esta ação do agente de repositório.",
  },
  en: {
    unknown: "The call may have been processed. The agent will not automatically repeat it or report an unknown cost as zero.",
    provider: "The current connection does not support repository tools or changed after this question started. Choose a compatible connection and start a new question.",
    context: "The authorization, repository revision or history changed. Review and approve the context again.",
    limit: "The agent reached this question's limit. Review the context and ask a more specific question.",
    generic: "This repository agent action could not be completed.",
  },
  es: {
    unknown: "La llamada puede haberse procesado. El agente no la repetirá automáticamente ni mostrará un coste desconocido como cero.",
    provider: "La conexión actual no admite herramientas del repositorio o cambió después del inicio. Elige una conexión compatible y comienza otra pregunta.",
    context: "La autorización, revisión del repositorio o historial cambió. Revisa y aprueba el contexto de nuevo.",
    limit: "El agente alcanzó el límite de esta pregunta. Revisa el contexto y haz una pregunta más específica.",
    generic: "No se pudo completar esta acción del agente de repositorio.",
  },
};
export function repositoryAgentMessage(code: string, language: string | null) {
  const catalog = messages[localeFrom(language)];
  if (code.includes("unknown")) return catalog.unknown;
  if (code.includes("provider")) return catalog.provider;
  if (/revision|consent|history|session|not_found/.test(code)) return catalog.context;
  if (/limit|expired/.test(code)) return catalog.limit;
  return catalog.generic;
}
