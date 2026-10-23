import { expect, test } from "bun:test";
import { taskRubric } from "../support/provider-rubrics.ts";
import { holdoutRubric } from "../support/provider-holdout.ts";
import { confirmationRubric } from "../support/provider-confirmation.ts";
import { finalRubric } from "../support/provider-final.ts";
import { conciseRubric } from "../support/provider-concise.ts";

test("technical concept matching supports accents without accepting a missing concept", () => {
  for (const word of ["idempotência", "idempotency", "idempotencia"])
    expect(taskRubric("retry", `${word}, backoff exponencial, jitter`).passed).toBe(true);
  expect(taskRubric("retry", "backoff exponencial, jitter").passed).toBe(false);
});

test("independent confirmation expects its own values and preserves fiction constraints", () => {
  expect(confirmationRubric("code", "Use Set in O(n); output [9,4,7]").passed).toBe(true);
  expect(confirmationRubric("code", "Use Set in O(n); output [8,5,3]").passed).toBe(false);
  expect(confirmationRubric("story", "Hypothetical example: Python 25 minutes to 5 minutes; 80%.").passed).toBe(true);
  expect(confirmationRubric("story", "Python 25 minutes to 5 minutes; 80%.").passed).toBe(false);
  expect(finalRubric("code", "Set in O(n), [6,2,8]").passed).toBe(true);
  expect(finalRubric("code", "Set in O(n), [9,4,7]").passed).toBe(false);
  expect(finalRubric("story", "Ejemplo hipotético: Python 50 a 10 minutos, 80%.").passed).toBe(true);
  expect(conciseRubric("code", "```ts\n// Set O(n) [0,-1,2]\n```").passed).toBe(true);
  expect(conciseRubric("retry", "idempotência backoff exponencial jitter\n```ts\nrun();\n```").passed).toBe(false);
});

test("strict holdout fiction format remains separate from useful factual output", () => {
  expect(holdoutRubric("story", "Exemplo hipotético: Python, de 30 para 6 minutos, 80%.").passed).toBe(true);
  expect(holdoutRubric("story", "Eu usei Python, de 30 para 6 minutos, 80%.").passed).toBe(false);
});
