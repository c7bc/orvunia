import type { RealtimeAudio } from "./recorder";
import type { RealtimeOptions, RealtimeStateCallback } from "./contracts";
import { workletEvent } from "./protocol";
import { audioFailure } from "../audio/contracts";
import { captureNativeRealtime } from "../system-audio/realtime.js";

export async function capture(
  state: RealtimeAudio,
  source: string,
  socket: WebSocket,
  onState: RealtimeStateCallback,
  options: RealtimeOptions,
) {
  if (state.stopping) throw new DOMException("Interrupted", "AbortError");
  if (source === "display" && state.platform.native)
    return captureNativeRealtime(state, state.platform.native, socket, onState, options);
  const platform = state.platform;
  const assertActive = () => {
    if (state.stopping) throw new DOMException("Interrupted", "AbortError");
    if (!platform.open(socket)) throw Error("A escuta foi desconectada.");
  };
  assertActive();
  state.stream = await platform.acquire(source, options.device);
  assertActive();
  if (!state.stream.getAudioTracks().length)
    throw Error("A fonte selecionada não compartilha áudio.");
  const context = (state.context = platform.context());
  await context.audioWorklet.addModule("/pcm-worklet.js");
  assertActive();
  state.source = context.createMediaStreamSource(
    platform.stream(state.stream.getAudioTracks()),
  );
  const processor = (state.processor = platform.processor(context, source));
  let utteranceId: string | undefined;
  processor.port.onmessage = (event: MessageEvent<unknown>) => {
    try {
      const data = workletEvent(event.data);
      if (!data) return;
      if (data.type === "signal") {
        if (!state.stopping) state.signal = data;
        return;
      }
      if (data.type === "activity") {
        state.activity(data.active, platform.clock() - (data.silentForMilliseconds ?? 0));
        return;
      }
      if (data.type === "flushed") {
        if (data.id) state.waiters.get("local:" + data.id)?.resolve();
        else state.flushed?.();
        return;
      }
      if (state.stopping && state.starting) return;
      if (!platform.open(socket)) {
        if (data.type === "audio" && data.data.byteLength)
          state.confirmation.failure = Error("Uma fala ficou sem confirmação final. Confira a transcrição.");
        return;
      }
      if (socket.bufferedAmount > 480000) {
        if (data.type === "audio" && data.data.byteLength)
          state.confirmation.failure = Error("Uma fala ficou sem confirmação final. Confira a transcrição.");
        onState("error", "A conexão ficou lenta. A escuta foi pausada.");
        void state.stop();
        return;
      }
      if (data.type === "audio") {
        utteranceId ??= platform.identifier();
        try { socket.send(data.data); state.confirmation.append(data.data.byteLength); }
        catch (error) { state.confirmation.failure = audioFailure(error); throw error; }
      }
      if (data.type === "commit") {
        state.markCommit();
        socket.send(JSON.stringify({ type: "commit", time: options.time(), utteranceId }));
        onState("queued", state.pending + state.confirmation.deliveriesPending);
        if (data.end) utteranceId = undefined;
        onState("transcribing");
      }
    } catch (error) {
      state.error = audioFailure(error);
      onState("error", state.error.message);
      void state.stop();
    }
  };
  state.source.connect(processor);
  processor.connect(context.destination);
  await context.resume();
  assertActive();
  state.running = true;
  onState("recording");
  state.ping = setInterval(() => {
    if (platform.open(socket)) socket.send(JSON.stringify({ type: "ping" }));
  }, 30000);
  state.stream.getAudioTracks()[0]?.addEventListener(
    "ended",
    () => {
      onState("ended");
      void state.stop();
    },
    { once: true },
  );
}
