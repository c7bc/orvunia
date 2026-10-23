import { expansions } from "../../packages/expansions/service.ts";
import type { ExpansionRepository } from "../../packages/expansions/repository.ts";
import { recordedTranscription } from "../../packages/transcription/service.ts";
import { answers } from "../../packages/answers/service.ts";
import type { AnswerDependencies } from "../../packages/answers/dependencies.ts";
import type { ExecutionAccounting } from "../../packages/accounting/port.ts";

export function composeGeneration<Accounting extends ExecutionAccounting>(
  dependencies: Omit<AnswerDependencies, "usage" | "identifier" | "clock"> & {
    stages: ExpansionRepository;
  },
  meter: Accounting,
  recoverAccounting: (now: number) => Promise<void>,
  local: boolean,
) {
  const identifier = () => Bun.randomUUIDv7(),
    clock = () => Date.now();
  const audio = recordedTranscription({
    ...dependencies,
    usage: meter,
    identifier,
    clock,
    local,
  });
  const details = expansions({
    ...dependencies,
    usage: meter,
    identifier,
    clock,
  });
  const service = answers({ ...dependencies, usage: meter, identifier, clock });
  let pending: Promise<void> | null = null;
  const reconcile = () => {
    if (pending) return pending;
    pending = (async () => {
      await dependencies.operations.recover(clock());
      await dependencies.operationStages?.purge(clock());
      await recoverAccounting(clock());
      await meter.reconcile();
    })()
      .catch(() =>
        dependencies.log({
          event: "operation_recovery_failed",
          operationId: "none",
        }),
      )
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  const timer = setInterval(reconcile, 30_000);
  timer.unref();
  void reconcile();
  return {
    service,
    audio,
    details,
    usage: meter,
    async close() {
      clearInterval(timer);
      const stopped = await Promise.allSettled([
        service.close(),
        audio.close(),
        details.close(),
      ]);
      await pending;
      await meter.reconcile().catch(() =>
        dependencies.log({
          event: "usage_recovery_pending",
          operationId: "none",
        }),
      );
      const failures = stopped.flatMap((outcome) =>
        outcome.status === "rejected" ? [outcome.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "Generation cleanup failed");
    },
  };
}
