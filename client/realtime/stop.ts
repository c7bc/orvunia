import type { RealtimeAudio } from "./recorder";
import { audioFailure } from "../audio/contracts";

export async function stopAudio(state: RealtimeAudio) {
  if (state.nativeCapture) {
    try { await state.nativeCapture.stop(); }
    catch (error) {
      state.error = audioFailure(error); state.confirmation.failure = state.error;
      state.onState?.("error", state.error.message);
    }
  }
  state.source?.disconnect();
  state.stream?.getTracks().forEach((track) => track.stop());
  let drained = false;
  if (state.supportsFlush && (state.processor || state.nativeCapture) && state.platform.open(state.ws)) {
    try {
      await state.flush({ timeoutMs: 10000 });
      drained = true;
    } catch (error) {
      state.error =
        error instanceof Error ? error : Error(audioFailure(error).message);
      state.onState?.("error", audioFailure(error).message);
    }
  } else if (state.processor) {
    const processor = state.processor;
    await new Promise<void>((resolve) => {
      state.flushed = resolve;
      processor.port.postMessage({ type: "flush" });
      setTimeout(resolve, 1000);
    });
  }
  state.processor?.disconnect();
  if (state.context?.state !== "closed")
    await state.context?.close().catch(() => {});
  const until = state.platform.clock() + 8000;
  while (
    !drained &&
    state.pending > 0 &&
    state.platform.open(state.ws) &&
    state.platform.clock() < until
  )
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  if (!drained && state.pending > 0) {
    state.error ??= Error(
      "Uma fala ficou sem confirmação final. Confira a transcrição.",
    );
    state.onState?.(
      "error",
      "Uma fala ficou sem confirmação final. Confira a transcrição.",
    );
  }
  state.ws?.close();
}
