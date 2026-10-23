import type { OnboardingView } from "./contracts.js";
import { brandMark } from "../design/brand.js";
import { escapeHtml as escape } from "../design/escape.js";
import { lineIcon } from "./primitives.js";
import { choices } from "./primitives.js";
import { locales } from "./primitives.js";
import { industries } from "./primitives.js";
import { discoverySources } from "./primitives.js";
import { messages, submit } from "./messages.js";
export const card = (
  context: OnboardingView,
  value: string,
  label: string,
  description: string,
  field: "persona" | "mode" = "persona",
) =>
  `<button type="button" class="welcome-choice ${context.state?.[field] === value ? "selected" : ""}" data-welcome-choice="${field}:${value}" aria-pressed="${context.state?.[field] === value}">${field === "persona" ? `<span class="welcome-choice-icon">${lineIcon(({ job: "search", student: "student", professional: "briefcase", curious: "globe" } as Record<string, string>)[value], 22)}</span>` : ""}<span class="welcome-choice-copy"><strong>${label}</strong><span>${description}</span></span><i aria-hidden="true">${lineIcon("arrow", 16)}</i></button>`;
export function chipGroup(
  context: OnboardingView,
  field: "industry" | "discovery",
  values: string[],
) {
  return `<div class="welcome-chips" role="group" aria-label="${field === "industry" ? "Área de atuação" : "Como conheceu o Orvunia"}">${values.map((value) => `<button type="button" data-welcome-choice="${field}:${escape(value)}" class="${context.state?.[field] === value ? "selected" : ""}" aria-pressed="${context.state?.[field] === value}">${escape(value)}</button>`).join("")}</div>`;
}
export function onboardContent(context: OnboardingView) {
  const { state, step, demoAnswered } = context;
  if (!state) return "";
  if (step === 0)
    return `<div class="welcome-introduction"><div class="welcome-brand"><span aria-hidden="true">${brandMark(28)}</span> Orvunia</div><h1>Bem-vindo ao Orvunia</h1><p>Seu assistente de conversas com IA</p>${messages(context)}<button class="welcome-primary" type="button" data-welcome="next">Continuar ${lineIcon("arrow", 15)}</button></div>`;
  if (step === 1)
    return `<form class="welcome-form welcome-onboarding welcome-persona" data-welcome-form="onboarding"><h1>Qual combina com você?</h1>${messages(context)}<div class="welcome-choices">${card(context, "job", "Estou procurando trabalho", "Entrevistas, networking e conversas de carreira")}${card(context, "student", "Sou estudante", "Apresentações, pesquisas e aprendizado")}${card(context, "professional", "Uso no trabalho", "Clientes, reuniões e conversas com a equipe")}${card(context, "curious", "Quero conhecer", "Explore como o Orvunia entra no seu dia a dia")}</div><button class="welcome-back" type="button" data-welcome="back">Voltar</button></form>`;
  if (step === 2)
    return `<form class="welcome-form welcome-onboarding welcome-survey" data-welcome-form="onboarding"><h1>Conte um pouco mais</h1>${messages(context)}<fieldset><legend>Qual é sua área de atuação?</legend>${chipGroup(context, "industry", industries)}</fieldset><hr><fieldset><legend>Como você conheceu o Orvunia?</legend>${chipGroup(context, "discovery", discoverySources)}</fieldset><div class="welcome-nav">${submit(context, "Continuar")}</div><button type="button" class="welcome-back" data-welcome="back">Voltar</button></form>`;
  if (step === 5)
    return `<form class="welcome-form welcome-onboarding welcome-tour" data-welcome-form="onboarding"><small>Experimente o Orvunia</small><h1>Pergunte sobre<br>a conversa</h1><p>Peça ajuda para organizar uma resposta, entender um problema ou resumir os pontos importantes.</p>${messages(context)}${demoAnswered ? `<div class="welcome-demo-feedback">A resposta ilustrativa aparece ao lado. Em uma sessão, o Orvunia usará o contexto que você fornecer.</div>${submit(context, "Continuar")}` : `<button class="welcome-demo-trigger" type="button" data-welcome="demo-ask">Clique em <span>${lineIcon("send", 15)}</span> para experimentar</button>`}<button type="button" class="welcome-link" data-welcome="next">Pular ${lineIcon("arrow", 12)}</button><button class="welcome-back" type="button" data-welcome="back">Voltar</button></form>`;
  if (step === 6)
    return `<form class="welcome-form welcome-onboarding welcome-tour" data-welcome-form="onboarding"><small>Sempre por perto</small><h1>Mostre e oculte<br>quando precisar</h1><p>Seu assistente fica acessível por um atalho. Personalize os controles nas configurações.</p>${messages(context)}<div class="welcome-shortcut-keys" aria-label="Mostrar ou ocultar">${(
      context.shortcuts.toggle || "Ctrl + Shift + Espaço"
    )
      .split("+")
      .map((key) => `<kbd data-i18n-skip>${escape(key.trim())}</kbd>`)
      .join(
        "",
      )}</div>${submit(context, "Abrir meu espaço")}<button type="button" class="welcome-link" data-welcome="next">Pular ${lineIcon("arrow", 12)}</button><button type="button" class="welcome-back" data-welcome="back">Voltar</button></form>`;
  let fields = "",
    heading = "Prepare seu espaço",
    description = "Escolha o foco e os idiomas para suas próximas conversas.";
  if (step === 3)
    fields = `<div class="welcome-choices welcome-mode-choices">${card(context, "recruiter", "Conversa com recrutador", "Contexto, experiências e próximos passos", "mode")}${card(context, "technical", "Entrevista técnica", "Código, raciocínio e testes", "mode")}</div><label><span>Seu objetivo <small>opcional</small></span><input name="goal" maxlength="160" value="${escape(state.goal)}" placeholder="Ex.: praticar entrevistas para engenharia"></label><div class="welcome-two"><label><span>Experiência <small>opcional</small></span><select name="experience" aria-label="Experiência">${choices(
      [
        ["", "Prefiro não informar"],
        ["0–1", "0–1 ano"],
        ["1–3", "1–3 anos"],
        ["3–5", "3–5 anos"],
        ["5–8", "5–8 anos"],
        ["8–12", "8–12 anos"],
        ["12+", "12+ anos"],
      ],
      state.experience,
    )}</select></label><label>Idioma das respostas<select name="output" aria-label="Idioma das respostas">${choices(locales, state.output)}</select></label></div><label>Linguagem de código<select name="code" aria-label="Linguagem de código">${choices(
      [
        "TypeScript",
        "JavaScript",
        "Python",
        "Java",
        "C++",
        "C#",
        "Go",
        "Rust",
        "Kotlin",
        "Swift",
        "SQL",
        "Ruby",
      ].map((value): [string, string] => [value, value]),
      state.code,
    )}</select></label>`;
  if (step === 4) {
    heading = context.setup?.heading ?? "Seus modelos, sua escolha";
    description = context.setup?.description ?? "Conecte as APIs de geração de respostas e transcrição que você prefere.";
    fields = context.setup?.fields ?? `<div class="welcome-provider-options"><div>${lineIcon("globe", 23)}<h3>Geração de respostas</h3><p>Escolha seu provedor e o modelo que vai usar.</p></div><div>${lineIcon("briefcase", 23)}<h3>Transcrição</h3><p>Configure o áudio separadamente, conforme sua preferência.</p></div><button type="button" class="welcome-secondary" data-welcome="providers">Configurar provedores</button><small>Você pode fazer isso depois nas configurações.</small></div>`;
  }
  return `<form class="welcome-form welcome-onboarding welcome-setup" data-welcome-form="onboarding"><h1>${heading}</h1><p>${description}</p>${messages(context)}${fields}<div class="welcome-nav">${submit(context, "Continuar")}</div><button type="button" class="welcome-back" data-welcome="back">Voltar</button><button type="button" class="welcome-link" data-welcome="skip" ${context.busy ? "disabled" : ""}>Pular configuração</button></form>`;
}
