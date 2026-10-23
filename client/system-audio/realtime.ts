import type { RealtimeAudio } from "../realtime/recorder.js";
import type { RealtimeOptions, RealtimeStateCallback } from "../realtime/contracts.js";
import type { NativeAudioBridge } from "./bridge.js";
import { captureNativePcm } from "./capture.js";
import { audioFailure } from "../audio/contracts.js";
import { SpeechActivity } from "../audio/speech-activity.js";

export async function captureNativeRealtime(state: RealtimeAudio, bridge: NativeAudioBridge, socket: WebSocket,
  onState: RealtimeStateCallback, options: RealtimeOptions) {
  let turnFrames = 0, samples = 0, sentSamples = 0, commits = 0;
  let lastFrameAt = state.platform.clock(), zeroFrames = 0;
  let utteranceId: string | undefined;
  let capturing = false, preBytes = 0;
  const pre: Uint8Array[] = [];
  const speech = new SpeechActivity();
  const send = (data: Uint8Array) => {
    if (!state.platform.open(socket) || socket.bufferedAmount > 480000) {
      console.warn("system_audio_transport", { readyState: socket.readyState,
        bufferedBytes: socket.bufferedAmount, stopping: state.stopping });
      throw state.error ?? Error(state.platform.open(socket) ? "system_audio_backpressure" : "system_audio_disconnected");
    }
    socket.send(new Uint8Array(data).buffer); state.confirmation.append(data.byteLength);
    turnFrames += data.byteLength / 2; sentSamples += data.byteLength / 2;
  };
  const commit = (end = false) => {
    if (!turnFrames || !state.platform.open(socket)) { if (end) utteranceId = undefined; return; }
    if (turnFrames < 2400) {
      const padding = new Uint8Array((2400 - turnFrames) * 2);
      send(padding);
    }
    turnFrames = 0; commits++; state.markCommit();
    socket.send(JSON.stringify({ type: "commit", time: options.time(), utteranceId })); onState("transcribing");
    onState("queued", state.pending + state.confirmation.deliveriesPending);
    if (end) utteranceId = undefined;
  };
  state.nativeAbort = new AbortController();
  const capture = await captureNativePcm(bridge, {
    signal: state.nativeAbort.signal,
    sessionId: options.sessionId, endpointId: options.device || "default:multimedia",
    identifier: state.platform.identifier,
    frame(data, rms, peak) {
      if (state.stopping && state.starting) return;
      try {
        samples += data.byteLength / 2;
        lastFrameAt = state.platform.clock();
        const wasSpeaking = speech.active;
        const speaking = speech.observe(rms, data.byteLength / 48, lastFrameAt);
        state.activity(speaking, speaking ? lastFrameAt : speech.lastSpeechAt || lastFrameAt);
        const audible = rms >= speech.threshold;
        if (!capturing && !audible) {
          pre.push(data.slice()); preBytes += data.byteLength;
          while (preBytes > 14400 && pre.length) {
            const first = pre[0]!, remove = Math.min(first.byteLength, preBytes - 14400);
            if (remove === first.byteLength) pre.shift(); else pre[0] = first.slice(remove);
            preBytes -= remove;
          }
          state.signal = { type: "signal", mode: "continuous", receivedSamples: samples, sentSamples,
            commits, rms, peak, channels: 1 };
          return;
        }
        utteranceId ??= state.platform.identifier();
        if (!capturing) { capturing = true; for (const part of pre) send(part); pre.length = 0; preBytes = 0; }
        send(data);
        zeroFrames = !audible ? zeroFrames + data.byteLength / 2 : 0;
        state.signal = { type: "signal", mode: "continuous", receivedSamples: samples, sentSamples,
          commits, rms, peak, channels: 1 };
        if ((wasSpeaking && !speaking) || zeroFrames >= 24000 * 0.6 || turnFrames >= 24000 * 15) {
          const end = (wasSpeaking && !speaking) || zeroFrames >= 24000 * 0.6;
          commit(end); zeroFrames = 0;
          if (end) { capturing = false; speech.idle(); state.activity(false, speech.lastSpeechAt || lastFrameAt); }
        }
      } catch (error) {
        if (peak > 0 || turnFrames > 0) state.confirmation.failure = audioFailure(error);
        throw error;
      }
    },
    ended(error) {
      if (error) { state.error ??= error; onState("error", state.error.message); }
      else onState("ended");
      void state.stop();
    },
  });
  const timer = setInterval(() => {
    if (state.platform.clock() - lastFrameAt < 650) return;
    speech.idle();
    capturing = false;
    state.activity(false, speech.lastSpeechAt || lastFrameAt);
    try { commit(true); } catch (error) {
      state.error = audioFailure(error); state.confirmation.failure = state.error;
      onState("error", state.error.message); void state.stop();
    }
  }, 100);
  state.nativeCapture = {
    async flush(boundary) { await capture.flush(boundary); commit(); capturing = false; zeroFrames = 0; },
    async stop() { clearInterval(timer); await capture.stop(); pre.length = 0; preBytes = 0; },
  };
  if (state.stopping) { await state.nativeCapture.stop(); throw new DOMException("Interrupted", "AbortError"); }
  state.running = true; onState("recording");
  state.ping = setInterval(() => {
    if (state.platform.open(socket)) socket.send(JSON.stringify({ type: "ping" }));
  }, 30000);
}
