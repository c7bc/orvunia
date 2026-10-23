import type { StyleTask } from "./provider-rubrics.ts";

export const finalTasks = {
  "pt-BR": {
    code: "Um consumidor recebe os IDs [6,2,6,8,2]. Escreva uma função TypeScript que remova repetidos sem mudar a ordem. Mostre saída, mecanismo, complexidade e um caso extremo.",
    retry: "Um worker de webhooks de pagamento recebe HTTP 500 e 503 temporários. Proponha retries sem duplicar o processamento usando idempotência, backoff exponencial e jitter. Inclua um exemplo e uma verificação.",
    story: "Exercício totalmente fictício, sem relação com minha biografia: uma automação Python gerava relatórios e mudou uma rotina de 50 minutos para 10 minutos. São os únicos fatos estipulados. Apresente problema, mecanismo proposto, validação e redução percentual. Identifique como hipóteses os detalhes de implementação e validação inventados.",
  },
  en: {
    code: "A consumer receives IDs [6,2,6,8,2]. Write a TypeScript function removing repeats without changing order. Show output, mechanism, complexity and one edge case.",
    retry: "A payment webhook worker receives temporary HTTP 500 and 503. Propose retries without duplicate processing using idempotency, exponential backoff and jitter. Include an example and verification.",
    story: "Entirely fictional exercise, unrelated to my biography: a Python automation generated reports and changed a routine from 50 minutes to 10 minutes. Those are the only stipulated facts. Present the problem, proposed mechanism, validation and percentage reduction. Label invented implementation and validation details as hypothetical.",
  },
  es: {
    code: "Un consumidor recibe los IDs [6,2,6,8,2]. Escribe una función TypeScript que elimine repetidos sin cambiar el orden. Muestra salida, mecanismo, complejidad y un caso límite.",
    retry: "Un worker de webhooks de pago recibe HTTP 500 y 503 temporales. Propón reintentos sin duplicar el procesamiento con idempotencia, backoff exponencial y jitter. Incluye un ejemplo y verificación.",
    story: "Ejercicio completamente ficticio, ajeno a mi biografía: una automatización Python generó informes y cambió una rutina de 50 minutos a 10 minutos. Son los únicos hechos estipulados. Presenta problema, mecanismo propuesto, validación y reducción porcentual. Identifica como hipótesis los detalles de implementación y validación inventados.",
  },
} as const;

export function finalRubric(task: StyleTask, text: string) {
  const checks = task === "code" ? {
    mechanism: /\bSet\b/.test(text), output: /6\s*,\s*2\s*,\s*8/.test(text), complexity: /O\(n\)/i.test(text),
  } : task === "retry" ? {
    idempotency: /idempoten/i.test(text.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    backoff: /exponen|backoff/i.test(text), jitter: /jitter/i.test(text),
  } : {
    reduction: /80\s*%/.test(text), mechanism: /Python/i.test(text), stipulatedInputs: /50/.test(text) && /10/.test(text),
    fictionalLabelFirst: /^[\s#*_]*(?:exemplo hipot[eé]tico|hypothetical example|ejemplo hipot[eé]tico)/i.test(text),
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}
