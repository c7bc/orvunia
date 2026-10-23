import type { Transcript } from "../realtime/contracts.js";
export type AudioStamp = Readonly<{
  workspace: string;
  audioSessionId: string | null;
  audioTimeOrigin: number;
  language: string;
}>;
type TranscriptionResult = (Transcript & { empty?: false }) | { empty: true };
export function createAudioTranscription(ports: {
  current(): { id: string; state: string } | null;
  context(): AudioStamp;
  clock(): number;
  duration(): number;
  format(seconds: number): string;
  identifier(): string;
  request(
    path: string,
    body: FormData,
    signal: AbortSignal,
    workspace: string,
  ): Promise<TranscriptionResult>;
  accept(transcript: Transcript, sessionId: string): void;
}) {
  const pending = new Map<AbortController, Promise<void>>();
  let disposed = false,
    version = 0;
  function send(
    blob: Blob,
    who: string,
    sessionId = ports.current()?.id,
    stamp = ports.context(),
  ) {
    if (
      disposed ||
      !sessionId ||
      (ports.current()?.id === sessionId && ports.current()?.state === "ended")
    )
      return Promise.resolve();
    const selected = sessionId,
      epoch = version,
      controller = new AbortController();
    const task = Promise.resolve()
      .then(async () => {
        controller.signal.throwIfAborted();
        const body = new FormData();
        body.append(
          "file",
          blob,
          blob.type === "audio/wav" ? "audio.wav" : "audio.webm",
        );
        body.append("language", stamp.language);
        body.append("who", who);
        body.append(
          "time",
          ports.format(
            Math.floor(
              Math.max(
                0,
                selected === stamp.audioSessionId && stamp.audioTimeOrigin
                  ? Math.max(0, (ports.clock() - stamp.audioTimeOrigin) / 1000)
                  : ports.duration(),
              ),
            ),
          ),
        );
        body.append("segmentId", ports.identifier());
        const result = await ports.request(
          `/sessions/${selected}/transcribe`,
          body,
          controller.signal,
          stamp.workspace,
        );
        controller.signal.throwIfAborted();
        if (
          !disposed &&
          epoch === version &&
          ports.context().workspace === stamp.workspace &&
          !result.empty
        )
          ports.accept(result, selected);
      })
      .finally(() => {
        pending.delete(controller);
      });
    pending.set(controller, task);
    return task;
  }
  function reset() {
    version++;
    for (const controller of pending.keys()) controller.abort();
  }
  return {
    send,
    reset,
    async settle() {
      const results = await Promise.allSettled(pending.values());
      const failure = results.find((value) => value.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    },
    dispose() {
      disposed = true;
      reset();
    },
  };
}
