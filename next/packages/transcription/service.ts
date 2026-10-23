import { OperationError } from "../operations/domain.ts";
import type { RecordedAudio } from "./domain.ts";
import type { TranscriptionDependencies } from "./dependencies.ts";
import { operationSupervisor } from "../operations/supervisor.ts";
import { prepareTranscription } from "./prepare.ts";
import { runTranscription } from "./run.ts";
import { validateRecordedAudio } from "./validation.ts";

export function recordedTranscription(dependencies: TranscriptionDependencies) {
  const supervisor = operationSupervisor();
  return {
    async transcribe(
      workspaceId: string,
      id: string,
      input: RecordedAudio,
      signal: AbortSignal,
      authorized: () => Promise<boolean>,
    ) {
      return supervisor.run(signal, async (combined) => {
        if (!(await authorized())) throw new OperationError("unauthorized");
        combined.throwIfAborted();
        validateRecordedAudio(input);
        const cached = await dependencies.sessions.legacySegment(
          workspaceId,
          id,
          input.segmentId,
        );
        if (cached) {
          if (!(await authorized())) throw new OperationError("unauthorized");
          combined.throwIfAborted();
          return cached;
        }
        const operation = await prepareTranscription(
          dependencies,
          workspaceId,
          id,
          input,
        );
        const result = await runTranscription(
          dependencies,
          operation,
          input,
          combined,
          authorized,
        );
        if (result.empty) return { text: "", empty: true as const };
        return {
          id: result.id,
          text: result.text,
          who: input.who,
          time: input.time,
          source: "audio" as const,
          segmentId: input.segmentId,
        };
      });
    },
    close: supervisor.close,
  };
}
export type RecordedTranscriptionService = ReturnType<
  typeof recordedTranscription
>;
