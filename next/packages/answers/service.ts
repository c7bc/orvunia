import type { AnswerDependencies } from "./dependencies.ts";
import type { AnswerInput } from "../contracts/answers.ts";
import type { Operation } from "../operations/domain.ts";
import { operationSupervisor } from "../operations/supervisor.ts";
import { prepareAnswer } from "./prepare.ts";
import { runAnswer } from "./run.ts";
import type { AnswerPreparationOptions } from "./preparation.ts";
export function answers(dependencies: AnswerDependencies) {
  const supervisor = operationSupervisor();
  return {
    async prepare(
      workspaceId: string,
      id: string,
      input: AnswerInput,
      allowEnded: boolean,
      options: AnswerPreparationOptions = {},
    ) {
      supervisor.assertOpen();
      return prepareAnswer(dependencies, workspaceId, id, input, allowEnded, options);
    },
    run(
      operation: Operation,
      signal: AbortSignal,
      delta: (text: string) => void,
      authorized: () => Promise<boolean>,
    ) {
      return supervisor.run(signal, (combined) =>
        runAnswer(dependencies, operation, combined, delta, authorized),
      );
    },
    close: supervisor.close,
  };
}
export type AnswerService = ReturnType<typeof answers>;
