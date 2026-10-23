import type { ChunkRecorder } from "./recorder";
import { audioFailure } from "./contracts";

export function recordChunk(state: ChunkRecorder) {
  if (!state.running) return;
  if (!state.audioStream || !state.mime || !state.onChunk)
    throw Error("A gravação ainda não foi inicializada.");
  state.speech = false;
  const chunks: Blob[] = [];
  const recorder = state.platform.recorder(state.audioStream, state.mime);
  state.recorder = recorder;
  const started = state.platform.clock();
  state.currentStopped = new Promise<void>((resolve) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      state.error = Error("Falha ao gravar o áudio.");
      state.running = false;
      state.release();
      state.onState?.("error", state.error.message);
      resolve();
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: state.mime ?? "" });
      if (
        state.speech &&
        state.platform.clock() - started > 250 &&
        blob.size > 300
      ) {
        state.queued++;
        state.onState?.("queued", state.queued);
        state.queue = state.queue
          .then(() => state.onChunk?.(blob))
          .catch((error: unknown) => {
            state.error = audioFailure(error);
            state.running = false;
            state.release();
            state.onState?.("error", state.error.message);
          })
          .finally(() => {
            state.queued--;
            state.onState?.("queued", state.queued);
          });
      }
      if (state.queued >= 8) {
        state.running = false;
        state.onState?.(
          "backpressure",
          "Gravação pausada para concluir os trechos pendentes.",
        );
        state.release();
      }
      resolve();
      if (state.running) state.recordChunk();
    };
  });
  recorder.start();
  state.chunkTimer = setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
  }, state.chunkMilliseconds || 6000);
}
