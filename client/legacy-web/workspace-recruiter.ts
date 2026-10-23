import {
  type WorkspaceContext,
  type WorkspaceController,
} from "./workspace-types.js";
import { spanishRecruiter } from "./recruiter-spanish.js";
export function createWorkspaceRecruiter({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): Pick<
  WorkspaceController,
  "recruiterContent" | "answerMeta"
> {
  return {
    recruiterContent() {
      const english = browser.preferences.output === "en";
      const spanish = browser.preferences.output.startsWith("es");
      const relatedFollowup = /trade.off|time|alinh|different|diferente/i.test(
        browser.transcripts.recruiter.at(-1)?.text || "",
      );
      const texts: Record<
        string,
        { title: string; summary: string; body: string; notes: string[] }
      > = {
        assist: {
          title: english
            ? "Connect your decision to its impact."
            : relatedFollowup
              ? "Explique como você tomou a decisão."
              : "Conecte a decisão ao impacto.",
          summary: english
            ? "Use one real project and keep the explanation focused."
            : "Use um projeto real e deixe claro o que você decidiu, por quê e o que aconteceu.",
          body: english
            ? `“In a project relevant to this role, I first clarified the problem and the constraints. I compared the available options with the team and chose the approach that best balanced delivery speed and maintainability. I would explain my contribution and share the actual outcome.”`
            : "“Em um projeto relevante para essa vaga, comecei entendendo o problema e as restrições. Comparei as alternativas com o time e escolhi a abordagem que equilibrava prazo e manutenção. Explicaria minha contribuição na decisão e fecharia com o resultado que realmente obtivemos.”",
          notes: english
            ? [
                "Replace the example with a project from your background.",
                "Use a result you can substantiate.",
              ]
            : [
                "Substitua o exemplo por um projeto do seu histórico.",
                "Inclua um resultado que você consiga comprovar.",
              ],
        },
        followup: {
          title: english
            ? "Keep the conversation moving."
            : "Faça a conversa avançar.",
          summary: english
            ? "Two questions to better understand the role."
            : "Duas perguntas para entender melhor a oportunidade.",
          body: english
            ? "1. What are the most important technical challenges for this team in the next six months?\n\n2. How do you define success for someone in this role after the first three months?"
            : "1. Quais são os desafios técnicos mais importantes para esse time nos próximos seis meses?\n\n2. Como vocês definem sucesso para alguém nessa posição nos primeiros três meses?",
          notes: [
            english
              ? "Choose the question that fits the current conversation."
              : "Escolha a pergunta que combina com o momento da conversa.",
          ],
        },
        star: {
          title: "Estruture sua história em STAR.",
          summary:
            "Um roteiro para transformar sua experiência em uma resposta clara.",
          body: "Situação — Qual problema o projeto precisava resolver?\n\nTarefa — Qual era sua responsabilidade?\n\nAção — O que você fez e por que escolheu essa abordagem?\n\nResultado — O que mudou e como você mediu o impacto?",
          notes: [
            "Use seu contexto abaixo como referência; esta demo não interpreta documentos.",
            browser.profile.experience.slice(0, 180) +
              (browser.profile.experience.length > 180 ? "…" : ""),
          ],
        },
        recap: {
          title: english
            ? "Where the conversation stands."
            : "Onde a conversa está.",
          summary: english
            ? "A recap of the visible sample transcript."
            : "Resumo da transcrição de exemplo visível.",
          body: browser.transcripts.recruiter
            .slice(-3)
            .map((t) => `${t.who}: ${t.text}`)
            .join("\n\n"),
          notes: [
            english
              ? "Next step: prepare a concrete project example."
              : "Próximo passo: preparar um exemplo concreto de projeto.",
          ],
        },
        custom: {
          title: english
            ? "Your question, with context."
            : "Sua pergunta, com contexto.",
          summary: browser.customQuestion,
          body: english
            ? "This local demo does not generate AI answers. A good answer should connect a real example from your background to the role, explain your reasoning and finish with the impact."
            : "Esta demo local não gera respostas com IA. Para essa pergunta, organize uma experiência real do seu histórico, conecte-a à vaga, explique sua decisão e feche com o impacto.",
          notes: [
            `Perfil: ${browser.profile.role}`,
            `Vaga: ${browser.profile.job}`,
          ],
        },
      };
      if (spanish)
        Object.assign(texts, spanishRecruiter(browser, relatedFollowup));
      const a = texts[browser.answerKind] || texts.assist!;
      return `<div class="answer-label">${ports.icon("spark")}${spanish ? "UN PUNTO DE PARTIDA" : english ? "A STARTING POINT" : "UM PONTO DE PARTIDA"}</div><h3 class="answer-title">${ports.escape(a.title)}</h3><p class="answer-summary">${ports.escape(a.summary)}</p><div class="answer-card"><span class="quote-mark">“</span><p>${ports.escape(a.body).replace(/\n/g, "<br>")}</p></div><ul class="answer-notes">${a.notes.map((t) => `<li>${ports.icon("check")}<span>${ports.escape(t)}</span></li>`).join("")}</ul>${workspace.answerMeta(spanish ? "Respuesta de ejemplo" : english ? "Example response" : "Resposta de exemplo")}`;
    },
    answerMeta(text: string) {
      return `<div class="answer-meta"><span>${ports.escape(text)} · ${browser.preferences.output.startsWith("es") ? "Perfil + puesto" : "Perfil + vaga"}</span><button class="copy-answer" data-action="copy-answer">${ports.icon("copy")}Copiar</button></div>`;
    },
  };
}
