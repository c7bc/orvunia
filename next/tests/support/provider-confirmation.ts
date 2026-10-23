import type { StyleTask } from "./provider-rubrics.ts";

export const confirmationTasks = {
  "pt-BR": {
    code: "Escreva uma função TypeScript que remova duplicatas de [9,4,9,7,4] preservando a ordem. Mostre a saída, o mecanismo, a complexidade e um caso extremo.",
    retry: "Um worker de integração enfrenta HTTP 408 e 429 transitórios. Explique como repetir sem duplicar efeitos usando idempotência, backoff exponencial e jitter; inclua um exemplo e uma verificação.",
    story: "Exercício inteiramente fictício, sem relação com minha experiência: uma automação Python consolidou planilhas e reduziu uma rotina de 25 minutos para 5 minutos. Esses tempos são os únicos fatos estipulados. Apresente problema, mecanismo proposto, validação e redução percentual; identifique como hipótese os detalhes de implementação e validação inventados.",
  },
  en: {
    code: "Write a TypeScript function removing duplicates from [9,4,9,7,4] while preserving order. Show the output, mechanism, complexity and one edge case.",
    retry: "An integration worker encounters transient HTTP 408 and 429. Explain retries without duplicate effects using idempotency, exponential backoff and jitter; include an example and verification.",
    story: "Entirely fictional exercise, unrelated to my experience: a Python automation consolidated spreadsheets and reduced a routine from 25 minutes to 5 minutes. Those times are the only stipulated facts. Present the problem, proposed mechanism, validation and percentage reduction; label invented implementation and validation details as hypothetical.",
  },
  es: {
    code: "Escribe una función TypeScript para eliminar duplicados de [9,4,9,7,4] conservando el orden. Muestra salida, mecanismo, complejidad y un caso límite.",
    retry: "Un worker de integración recibe HTTP 408 y 429 transitorios. Explica reintentos sin duplicar efectos con idempotencia, backoff exponencial y jitter; incluye un ejemplo y verificación.",
    story: "Ejercicio totalmente ficticio, ajeno a mi experiencia: una automatización Python consolidó hojas de cálculo y redujo una rutina de 25 minutos a 5 minutos. Esos tiempos son los únicos hechos estipulados. Presenta problema, mecanismo propuesto, validación y reducción porcentual; identifica como hipótesis los detalles de implementación y validación inventados.",
  },
} as const;

export function confirmationRubric(task: StyleTask, text: string) {
  const checks = task === "code" ? {
    mechanism: /\bSet\b/.test(text), output: /9\s*,\s*4\s*,\s*7/.test(text), complexity: /O\(n\)/i.test(text),
  } : task === "retry" ? {
    idempotency: /idempoten/i.test(text.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    backoff: /exponen|backoff/i.test(text), jitter: /jitter/i.test(text),
  } : {
    reduction: /80\s*%/.test(text), mechanism: /Python/i.test(text), stipulatedInputs: /25/.test(text) && /5/.test(text),
    fictionalLabelFirst: /^[\s#*_]*(?:exemplo hipot[eé]tico|hypothetical example|ejemplo hipot[eé]tico)/i.test(text),
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}
