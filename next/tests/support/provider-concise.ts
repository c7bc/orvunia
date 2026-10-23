import type { StyleTask } from "./provider-rubrics.ts";

export const conciseTasks = {
  "pt-BR": {
    code: "Implemente uma função TypeScript que elimine duplicatas de [0,-1,0,2,-1] preservando a ordem. Mostre saída, mecanismo, complexidade e um caso extremo.",
    retry: "Uma sincronização de CRM recebe HTTP 502 e 429 temporários. Explique retries sem efeitos duplicados com idempotência, backoff exponencial e jitter, incluindo um exemplo e como verificar.",
    story: "Exercício inteiramente fictício, sem relação com minha experiência: uma automação Python de arquivamento reduziu uma rotina de 20 minutos para 4 minutos. São os únicos fatos estipulados. Explique problema, mecanismo proposto, validação e redução percentual, identificando os detalhes inventados como hipóteses.",
  },
  en: {
    code: "Implement a TypeScript function removing duplicates from [0,-1,0,2,-1] while preserving order. Show output, mechanism, complexity and one edge case.",
    retry: "A CRM synchronization receives temporary HTTP 502 and 429. Explain retries without duplicate effects using idempotency, exponential backoff and jitter, including an example and how to verify.",
    story: "Entirely fictional exercise, unrelated to my experience: a Python archiving automation reduced a routine from 20 minutes to 4 minutes. Those are the only stipulated facts. Explain the problem, proposed mechanism, validation and percentage reduction, labeling invented details as hypothetical.",
  },
  es: {
    code: "Implementa una función TypeScript que elimine duplicados de [0,-1,0,2,-1] conservando el orden. Muestra salida, mecanismo, complejidad y un caso límite.",
    retry: "Una sincronización de CRM recibe HTTP 502 y 429 temporales. Explica reintentos sin efectos duplicados con idempotencia, backoff exponencial y jitter, incluyendo un ejemplo y cómo verificar.",
    story: "Ejercicio totalmente ficticio, ajeno a mi experiencia: una automatización Python de archivado redujo una rutina de 20 minutos a 4 minutos. Son los únicos hechos estipulados. Explica problema, mecanismo propuesto, validación y reducción porcentual, identificando los detalles inventados como hipótesis.",
  },
} as const;

export function conciseRubric(task: StyleTask, text: string) {
  const checks = task === "code" ? {
    mechanism: /\bSet\b/.test(text), output: /0\s*,\s*-1\s*,\s*2/.test(text), complexity: /O\(n\)/i.test(text),
  } : task === "retry" ? {
    idempotency: /idempoten/i.test(text.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    backoff: /exponen|backoff/i.test(text), jitter: /jitter/i.test(text),
  } : {
    reduction: /80\s*%/.test(text), mechanism: /Python/i.test(text), stipulatedInputs: /20/.test(text) && /4/.test(text),
    fictionalLabelFirst: /^[\s#*_]*(?:exemplo hipot[eé]tico|hypothetical example|ejemplo hipot[eé]tico)/i.test(text),
  };
  const proseWords = text.replace(/```[\s\S]*?```/g, " ").trim().split(/\s+/u).length;
  return { checks: { ...checks, concise: proseWords <= 130, codeOnlyWhenRequested: task === "code" || !text.includes("```") },
    passed: Object.values(checks).every(Boolean) && proseWords <= 130 && (task === "code" || !text.includes("```")) };
}
