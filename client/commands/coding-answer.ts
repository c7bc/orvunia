import { requireCommandSession } from "./model.js";

import type { CommandContext } from "./ports.js";
export async function runCodingAnswerCommands(
  context: CommandContext,
  key: string,
  value: string,
): Promise<boolean> {
  const { state: browser, ports } = context;
  switch (key) {
    case "coding-explain":
    case "coding-debug":
    case "coding-tests":
    case "coding-optimize":
    case "coding-expand": {
      const response = requireCommandSession(browser).responses.find(
        (r) => r.id === value,
      );
      if (!response || browser.busy) return true;
      if (key === "coding-expand") {
        await ports.tellMore.open(
          requireCommandSession(browser).id,
          response.id,
        );
        return true;
      }
      const kind = key.slice(7),
        question = {
          explain:
            "Explique esta solução selecionada passo a passo, com um exemplo.",
          debug:
            "Revise esta solução selecionada: identifique bugs e casos extremos, sem alegar execução.",
          tests:
            "Sugira testes para esta solução selecionada com entradas e saídas esperadas, sem alegar execução.",
          optimize:
            "Otimize esta solução selecionada e compare complexidade de tempo e espaço.",
          expand:
            "Aprofunde esta resposta selecionada, esclarecendo premissas, alternativas e casos extremos.",
        }[kind];
      await ports.ask(
        kind === "expand" ? "custom" : kind,
        question,
        requireCommandSession(browser).state === "ended",
        {
          problemOverride: ports.selectedResponseProblem(
            response,
            ports.coding.problem(requireCommandSession(browser).id),
          ),
          captureIds:
            response.captureIds ||
            ports.coding.responseCaptureIds(
              requireCommandSession(browser).id,
              response.id,
            ),
        },
      );
      return true;
    }
    case "coding-retry": {
      const attempt = ports.attempt(requireCommandSession(browser).id);
      if (!attempt || attempt.expired || browser.busy) return true;
      await ports.ask(
        attempt.input.action,
        attempt.input.question,
        attempt.review,
        attempt.request
          ? { retry: attempt.request }
          : {
              problemOverride: attempt.input.problem,
              codeLanguage: attempt.input.codeLanguage,
            },
      );
      return true;
    }
    case "coding-new-attempt": {
      const attempt = ports.attempt(requireCommandSession(browser).id);
      if (!attempt || browser.busy) return true;
      await ports.ask(
        attempt.input.action,
        attempt.input.question,
        attempt.review,
      );
      return true;
    }
  }
  return false;
}
