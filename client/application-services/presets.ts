export function createNotePresets() {
  return {
    meeting: {
      title: "Reunião",
      description: "Decisões e próximos passos em uma conversa de trabalho.",
      sections: [
        {
          title: "Resumo",
          instructions: "Resuma os pontos principais da conversa.",
        },
        {
          title: "Decisões",
          instructions: "Liste as decisões e o motivo de cada uma.",
        },
        {
          title: "Próximos passos",
          instructions:
            "Liste ações, responsáveis e prazos quando mencionados.",
        },
      ],
    },
    interview: {
      title: "Entrevista",
      description: "Perguntas, experiências discutidas e acompanhamento.",
      sections: [
        {
          title: "Contexto",
          instructions:
            "Descreva a vaga e os assuntos discutidos sem inventar informações.",
        },
        {
          title: "Perguntas e respostas",
          instructions:
            "Registre as perguntas feitas e os exemplos reais apresentados.",
        },
        {
          title: "Acompanhamento",
          instructions: "Liste dúvidas, combinados e próximos passos.",
        },
      ],
    },
    technical: {
      title: "Entrevista técnica",
      description: "Problema, solução, complexidade e testes sugeridos.",
      sections: [
        {
          title: "Problema",
          instructions: "Registre requisitos, restrições e exemplos.",
        },
        {
          title: "Solução",
          instructions:
            "Explique a abordagem, o código discutido e os trade-offs.",
        },
        {
          title: "Complexidade e testes",
          instructions:
            "Anote custos de tempo e espaço, casos extremos e testes sugeridos. Diferencie sugestões de testes executados.",
        },
      ],
    },
  };
}
