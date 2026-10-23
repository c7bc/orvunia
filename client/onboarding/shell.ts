import { brandMark } from "../design/brand";
import type { OnboardingView } from "./contracts.js";
import { escapeHtml as escape } from "../design/escape.js";
import { lineIcon } from "./primitives.js";
export function preview(context: OnboardingView) {
  const { state, step, demoAnswered } = context;
  if (state && [1, 3, 4].includes(step))
    return `<div class="welcome-meeting-card"><small>Conversa em 2 minutos</small><h3>${state.mode === "technical" ? "Entrevista de engenharia" : "Conversa com o recrutador"}</h3><p>✦ 3 participantes</p><div class="welcome-participant-chips"><span>Você</span><span>Recrutador</span><span>Equipe</span></div><hr><strong>Prepare seu contexto</strong><p>Revise sua experiência e os assuntos importantes antes de começar.</p><div class="welcome-join-demo">${lineIcon("plus", 15)} Entrar e criar notas</div></div>`;
  if (state && step === 2)
    return `<div class="welcome-notes-preview"><h3>Entrevista de engenharia<br>Conversa técnica</h3><div class="welcome-notes-badge">${lineIcon("mail", 11)} Email de acompanhamento</div><div class="welcome-person-preview"><span>AR</span><div><strong>Entrevistador</strong><i></i></div></div><div class="welcome-person-preview"><span>EN</span><div><strong>Equipe de engenharia</strong><i></i></div></div><small>Notas da conversa</small><h4>Abertura e apresentações</h4><i></i><i></i><i></i><h4>Próximos passos</h4><i></i><i></i></div>`;
  return `<div class="welcome-demo-scene ${state && step === 6 ? "hide-example" : ""}"><div class="welcome-demo-control"><span class="welcome-demo-logo">${brandMark(24)}</span><span>⌃ Ocultar</span><i></i></div><div class="welcome-demo-call"><div class="welcome-demo-person"><span>Você</span></div><div class="welcome-demo-person"><span>Entrevistador</span></div><footer><span>◉ &nbsp; ◈</span><span>Encerrar</span></footer></div><div class="welcome-preview"><div class="welcome-preview-answer">${state && step === 5 && !demoAnswered ? "" : `<div class="welcome-preview-question">Como posso responder?</div><small>${lineIcon("search", 12)} Contexto da conversa</small><p>“Posso explicar uma experiência relevante, destacar minha contribuição e compartilhar o resultado que tivemos.”</p>`}</div><div class="welcome-preview-actions"><span>✣ Assist</span><span>✧ O que dizer?</span><span>♧ Perguntas</span><span>◷ Resumo</span></div><div class="welcome-preview-composer"><div>${state && step === 5 ? "Como posso responder?" : "Pergunte sobre sua tela ou conversa"}</div><div class="welcome-preview-footer"><span>Smart</span><span>☷</span><span>Orvunia ⌄</span><b>${lineIcon("send", 13)}</b></div></div></div></div>`;
}
export function shell(context: OnboardingView, content: string) {
  const { state, step } = context;
  const stage = state ? `onboarding-${step}` : "authentication";
  const titles =
    state && step === 2
      ? [
          "Suas conversas, organizadas.",
          "Do primeiro contato aos próximos passos.",
        ]
      : state && [1, 3, 4].includes(step)
        ? [
            "Chegue preparado à próxima conversa.",
            "Seu contexto, sempre à mão.",
          ]
        : state && step === 6
          ? [
              "Seu assistente, quando você precisa.",
              "Mostre e oculte com um atalho.",
            ]
          : ["Assistência em tempo real,", "pronta para ajudar."];
  return `<main class="welcome-shell ${stage}"><section class="welcome-main"><label class="welcome-ui-language"><span class="welcome-sr-only">Idioma da interface</span><select data-ui-locale aria-label="Idioma da interface"><option value="pt-BR" ${context.locale === "pt-BR" ? "selected" : ""}>Português</option><option value="en" ${context.locale === "en" ? "selected" : ""}>English</option><option value="es" ${context.locale === "es" ? "selected" : ""}>Español</option></select></label>${context.authenticationBrand ?? ""}${content}${state && step === 0 ? `<footer class="welcome-footer"><p>${context.footer ?? "Uma instalação local. Seus dados e seus modelos."}</p><div class="welcome-principles"><span>CÓDIGO ABERTO</span><span>SEU CONTEXTO</span><span>SEUS MODELOS</span></div></footer>` : ""}</section><aside class="welcome-aside"><div class="welcome-grid" aria-hidden="true"></div><div class="welcome-reference-preview" aria-hidden="true">${preview(context)}</div><h2>${titles[0]}<br><span>${titles[1]}</span></h2><small class="welcome-demo-label">Demonstração ilustrativa · sem captura de áudio ou tela</small></aside></main>`;
}
