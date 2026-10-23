import type { StyleTask } from "./provider-rubrics.ts";

export const holdoutTasks = {
  "pt-BR": {
    code: "Implemente em TypeScript a remoção de duplicatas de [8,5,8,3,5], mantendo a ordem. Mostre o resultado, explique o mecanismo e a complexidade.",
    retry: "Uma integração recebe HTTP 502 e 504 intermitentes. Proponha retentativas confiáveis com idempotência, backoff exponencial e jitter; dê um exemplo e explique como verificar.",
    story: "Exercício inteiramente fictício: uma automação Python mudou uma rotina de 30 minutos para 6 minutos. Prepare uma resposta sobre problema, mecanismo, validação e redução percentual. Esses tempos são os únicos fatos estipulados; identifique os detalhes de implementação propostos como hipótese. Não é uma experiência real minha.",
  },
  en: {
    code: "Implement TypeScript duplicate removal for [8,5,8,3,5], preserving order. Show the result, mechanism and complexity.",
    retry: "An integration returns intermittent HTTP 502 and 504. Propose reliable retries with idempotency, exponential backoff and jitter; give an example and explain verification.",
    story: "Entirely fictional exercise: a Python automation changed a routine from 30 minutes to 6 minutes. Prepare an answer about the problem, mechanism, validation and percentage reduction. Those times are the only stipulated facts; identify proposed implementation details as hypothetical. This is not my real experience.",
  },
  es: {
    code: "Implementa en TypeScript la eliminación de duplicados de [8,5,8,3,5] conservando el orden. Muestra el resultado, mecanismo y complejidad.",
    retry: "Una integración devuelve HTTP 502 y 504 intermitentes. Propón reintentos fiables con idempotencia, backoff exponencial y jitter; da un ejemplo y explica la verificación.",
    story: "Ejercicio totalmente ficticio: una automatización Python cambió una rutina de 30 minutos a 6 minutos. Prepara una respuesta sobre problema, mecanismo, validación y reducción porcentual. Esos tiempos son los únicos hechos estipulados; identifica detalles de implementación propuestos como hipótesis. No es mi experiencia real.",
  },
} as const;

export function holdoutRubric(task: StyleTask, text: string) {
  const checks = task === "code" ? {
    mechanism: /\bSet\b/.test(text), output: /8\s*,\s*5\s*,\s*3/.test(text), complexity: /O\(n\)/i.test(text),
  } : task === "retry" ? {
    idempotency: /idempoten/i.test(text.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    backoff: /exponen|backoff/i.test(text), jitter: /jitter/i.test(text),
  } : {
    reduction: /80\s*%/.test(text), mechanism: /Python/i.test(text), stipulatedInputs: /30/.test(text) && /6/.test(text),
    fictionalLabelFirst: /^[\s#*_]*(?:exemplo hipot[eé]tico|hypothetical example|ejemplo hipot[eé]tico)/i.test(text),
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}
