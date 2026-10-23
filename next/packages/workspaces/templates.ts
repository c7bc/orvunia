import type { ModeBase, NoteSection } from "./domain.ts";
import { globalSystemPrompt } from "../prompts/global.ts";
import { activityRoleInstructions, defaultRoleInstructions } from "../prompts/mode-instructions.ts";
export { defaultModeInstructions } from "../prompts/defaults.ts";
export { defaultModeSystemPrompt } from "../prompts/defaults-en.ts";
export type ModeTemplate = {
  id: string;
  name: string;
  base: ModeBase;
  description: string;
  systemPrompt: string;
  instructions: string;
  sections: NoteSection[];
};
export const modeTemplates: readonly ModeTemplate[] = [
  {
    id: "looking-for-work",
    name: "Procurando emprego",
    base: "recruiter",
    description:
      "Experiências, perguntas comportamentais e acompanhamento da vaga.",
    systemPrompt: globalSystemPrompt("en"),
    instructions: defaultRoleInstructions("recruiter") + "\n\nPriorize a trajetória, a contribuição pessoal e os resultados pertinentes à vaga.",
    sections: [
      {
        title: "Vaga e contexto",
        instructions:
          "Registre cargo, empresa, responsabilidades e expectativas mencionadas.",
      },
      {
        title: "Experiências discutidas",
        instructions:
          "Resuma as experiências e os exemplos reais apresentados.",
      },
      {
        title: "Perguntas e próximos passos",
        instructions:
          "Liste dúvidas, combinados, responsáveis e prazos explícitos.",
      },
    ],
  },
  {
    id: "technical-interview",
    name: "Entrevista técnica",
    base: "technical",
    description: "Problemas, raciocínio, código, testes e arquitetura.",
    systemPrompt: globalSystemPrompt("en"),
    instructions: defaultRoleInstructions("technical") + "\n\nConecte requisitos, raciocínio, implementação e validação conforme a pergunta técnica.",
    sections: [
      {
        title: "Problema",
        instructions: "Registre requisitos, restrições e exemplos.",
      },
      {
        title: "Solução e alternativas",
        instructions:
          "Explique raciocínio, abordagem, estruturas e compromissos discutidos.",
      },
      {
        title: "Testes e complexidade",
        instructions:
          "Registre casos extremos e complexidades. Não invente testes executados.",
      },
    ],
  },
  {
    id: "recruiting",
    name: "Recrutamento",
    base: "recruiter",
    description: "Perguntas de seleção, evidências e dúvidas a esclarecer.",
    systemPrompt: globalSystemPrompt("en"),
    instructions: activityRoleInstructions("recruiting") + "\n\nAprofunde as evidências das respostas com perguntas ligadas às responsabilidades da vaga.",
    sections: [
      {
        title: "Experiência",
        instructions: "Resuma conhecimentos e experiências demonstrados.",
      },
      {
        title: "Evidências",
        instructions:
          "Registre exemplos fornecidos, sem criar avaliações não sustentadas.",
      },
      {
        title: "Acompanhamento",
        instructions: "Liste dúvidas abertas e próximos passos combinados.",
      },
    ],
  },
  {
    id: "sales",
    name: "Vendas",
    base: "recruiter",
    description: "Descoberta, necessidades, objeções e próximos passos.",
    systemPrompt: globalSystemPrompt("en"),
    instructions: activityRoleInstructions("sales") + "\n\nPriorize necessidades, objeções e próximos passos úteis para esta conversa de vendas.",
    sections: [
      {
        title: "Necessidades",
        instructions: "Registre objetivos, dores e restrições explícitas.",
      },
      {
        title: "Objeções e dúvidas",
        instructions: "Liste perguntas, objeções e respostas discutidas.",
      },
      {
        title: "Próximos passos",
        instructions: "Liste ações, responsáveis e datas quando mencionadas.",
      },
    ],
  },
  {
    id: "team-meeting",
    name: "Reunião de equipe",
    base: "recruiter",
    description: "Decisões, tarefas, riscos e alinhamento do time.",
    systemPrompt: globalSystemPrompt("en"),
    instructions: activityRoleInstructions("meeting") + "\n\nDestaque decisões, riscos, dependências e ações discutidos pela equipe.",
    sections: [
      { title: "Resumo", instructions: "Sintetize os assuntos tratados." },
      {
        title: "Decisões",
        instructions: "Registre somente decisões explícitas e seus motivos.",
      },
      {
        title: "Ações",
        instructions: "Liste tarefas, responsáveis e prazos mencionados.",
      },
    ],
  },
  {
    id: "lecture",
    name: "Aula ou palestra",
    base: "recruiter",
    description: "Conceitos, exemplos e questões para estudar.",
    systemPrompt: globalSystemPrompt("en"),
    instructions: activityRoleInstructions("lecture") + "\n\nOrganize os conceitos, exemplos e dúvidas para facilitar a revisão do conteúdo.",
    sections: [
      {
        title: "Conceitos",
        instructions: "Organize os conceitos e as definições apresentados.",
      },
      {
        title: "Exemplos",
        instructions: "Registre exemplos e relações discutidas.",
      },
      {
        title: "Para revisar",
        instructions: "Liste perguntas abertas e tópicos de estudo.",
      },
    ],
  },
];
