import type { InterviewMode, Transcript } from "./models.js";
export const initialTranscripts: Record<InterviewMode, Transcript[]> = {
  recruiter: [
    {
      who: "Recrutadora",
      time: "00:12",
      text: "Daniel, queria começar entendendo um pouco da sua trajetória e o que você procura no seu próximo desafio.",
    },
    {
      who: "Você",
      time: "00:28",
      text: "Tenho trabalhado com desenvolvimento full stack, principalmente com TypeScript, React e Node.js. Gosto de participar desde a definição do problema até a entrega.",
    },
    {
      who: "Recrutadora",
      time: "00:46",
      text: "Pode contar sobre um projeto em que você precisou tomar uma decisão técnica importante?",
    },
  ],
  technical: [
    {
      who: "Entrevistador",
      time: "00:10",
      text: "Vamos resolver um problema de arrays. Receba uma lista de números e encontre dois índices cujos valores somam o alvo.",
    },
    {
      who: "Você",
      time: "00:24",
      text: "Posso assumir que existe exatamente uma solução? E não posso usar o mesmo elemento duas vezes, certo?",
    },
    {
      who: "Entrevistador",
      time: "00:36",
      text: "Isso. Explique sua abordagem antes de escrever o código e depois analise a complexidade.",
    },
  ],
};
