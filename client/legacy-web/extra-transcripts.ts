import type { InterviewMode } from "./models.js";
export const extraTranscripts: Record<
  InterviewMode,
  { who: string; text: string }[]
> = {
  recruiter: [
    {
      who: "Recrutadora",
      text: "Como você lidou com os trade-offs dessa decisão e alinhou a solução com o time?",
    },
    {
      who: "Você",
      text: "Comecei pelos requisitos e comparei as alternativas com o time antes de decidir.",
    },
    {
      who: "Recrutadora",
      text: "E o que você faria diferente se estivesse começando esse projeto hoje?",
    },
  ],
  technical: [
    {
      who: "Entrevistador",
      text: "Quais casos limite merecem atenção nessa abordagem?",
    },
    {
      who: "Você",
      text: "Vou percorrer os casos de exemplo e conferir as condições de parada.",
    },
    {
      who: "Entrevistador",
      text: "Como você justificaria a complexidade de tempo e memória dessa abordagem?",
    },
  ],
};
