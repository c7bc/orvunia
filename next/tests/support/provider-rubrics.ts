export const styleTasks = {
  "pt-BR": {
    code: "Escreva uma função TypeScript que remova duplicatas de [3,1,3,2,1] preservando a ordem. Explique o mecanismo, informe a saída e a complexidade.",
    retry: "Como integrar uma API com falhas HTTP 429/503 de forma confiável? Explique backoff exponencial, jitter e idempotência, com exemplo e validação.",
    story: "Este é um estudo fictício de preparação, não minha experiência real: uma automação Python reduziu um processo de 10 minutos para 2 minutos. Conte uma resposta objetiva com problema, mecanismo, validação e resultado percentual, usando somente esses fatos. Marque qualquer mecanismo adicional como hipótese e não invente empregador ou métricas.",
  },
  en: {
    code: "Write a TypeScript function that removes duplicates from [3,1,3,2,1] while preserving order. Explain the mechanism, output and complexity.",
    retry: "How would you reliably integrate an API that returns HTTP 429/503? Explain exponential backoff, jitter and idempotency, with an example and validation.",
    story: "This is a fictional preparation exercise, not my real experience: a Python automation reduced a process from 10 minutes to 2 minutes. Give an objective answer with problem, mechanism, validation and percentage outcome using only those facts. Label any additional mechanism as hypothetical and do not invent an employer or metrics.",
  },
  es: {
    code: "Escribe una función TypeScript que elimine duplicados de [3,1,3,2,1] conservando el orden. Explica el mecanismo, resultado y complejidad.",
    retry: "¿Cómo integrar de forma fiable una API con fallos HTTP 429/503? Explica backoff exponencial, jitter e idempotencia, con ejemplo y validación.",
    story: "Este es un ejercicio ficticio de preparación, no mi experiencia real: una automatización Python redujo un proceso de 10 minutos a 2 minutos. Da una respuesta objetiva con problema, mecanismo, validación y resultado porcentual usando solo esos hechos. Marca cualquier mecanismo adicional como hipotético y no inventes empleador ni métricas.",
  },
} as const;

export type StyleTask = keyof typeof styleTasks.en;
export function taskRubric(task: StyleTask, text: string) {
  const checks = task === "code" ? {
    mechanism: /\bSet\b/.test(text), output: /3\s*,\s*1\s*,\s*2/.test(text), complexity: /O\(n\)/i.test(text),
  } : task === "retry" ? {
    idempotency: /idempoten/i.test(text.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
    backoff: /exponen|backoff/i.test(text), jitter: /jitter/i.test(text),
  } : {
    reduction: /80\s*%/.test(text), mechanism: /Python/i.test(text),
    hypothetical: /hipot|hypot|fict[ií]|fiction|supos|assum/i.test(text),
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

export function parseAnswerStream(source: string) {
  const events = source.split("\n\n").flatMap(frame => {
    const event = /^event: (.+)$/m.exec(frame)?.[1];
    const data = /^data: (.+)$/m.exec(frame)?.[1];
    return event && data ? [{ event, data: JSON.parse(data) as Record<string, unknown> }] : [];
  });
  const done = events.find(event => event.event === "done");
  const error = events.find(event => event.event === "error");
  return { events, done, error, deltas: events.filter(event => event.event === "delta").length,
    text: typeof done?.data.text === "string" ? done.data.text : "" };
}
