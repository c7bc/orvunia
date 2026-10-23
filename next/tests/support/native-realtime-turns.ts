import { RealtimeAudio } from "../../../client/realtime/recorder.ts";
import { captureNativeRealtime } from "../../../client/system-audio/realtime.ts";
import type { RealtimePlatform } from "../../../client/realtime/contracts.ts";
import type { NativeAudioBridge } from "../../../client/system-audio/bridge.ts";

export async function nativeRealtimeTurns() {
  let at = 10_000, captureId = "", received = 0, sequence = 0;
  let listener: (event: unknown) => void = () => {};
  const commands: { type: string; utteranceId?: string }[] = [], packets: Uint8Array[] = [];
  const activity: { active: boolean; at: number }[] = [];
  const bridge: NativeAudioBridge = {
    async systemAudio(input) {
      const value = input as { action: string; captureId: string };
      if (value.action === "start") { captureId = value.captureId; return { captureId, sampleRate: 24000, channels: 1, format: "pcm_s16le" }; }
      return { frames: received };
    },
    onEvent(callback) { listener = callback; return () => { listener = () => {}; }; },
  };
  const forbidden = () => { throw Error("Hardware and network are forbidden in PCM fixture"); };
  const socket = { bufferedAmount: 0, send(value: string | ArrayBuffer) {
    if (typeof value === "string") commands.push(JSON.parse(value)); else packets.push(new Uint8Array(value));
  } } as WebSocket;
  const platform: RealtimePlatform = { native: bridge, request: forbidden, socket: forbidden, acquire: forbidden,
    context: forbidden, stream: forbidden, processor: forbidden, open: () => true, clock: () => at, identifier: () => crypto.randomUUID() };
  const state = new RealtimeAudio(platform);
  state.onState = (type, value) => { if (type === "activity") activity.push(value as { active: boolean; at: number }); };
  await captureNativeRealtime(state, bridge, socket, () => {}, { sessionId: crypto.randomUUID(), time: () => "00:01" });
  function frame(amplitude: number, sparse = false) {
    const pcm = new Int16Array(480);
    for (let index = 0; index < pcm.length; index++) pcm[index] = sparse ? (index === 0 ? Math.max(1, Math.round(amplitude * 32767)) : 0)
      : Math.round(amplitude * 32767 * Math.sin(index * 0.11));
    const energy = Math.sqrt(pcm.reduce((sum, value) => sum + (value / 32768) ** 2, 0) / pcm.length);
    const peak = pcm.reduce((maximum, value) => Math.max(maximum, Math.abs(value) / 32768), 0);
    received += pcm.length; at += 20;
    listener({ type: "system-audio", data: { type: "pcm", captureId, sequence: sequence++, data: new Uint8Array(pcm.buffer), rms: energy, peak } });
    return new Uint8Array(pcm.buffer);
  }
  return { state, commands, packets, activity, frame, now: () => at, advance(milliseconds: number) { at += milliseconds; },
    async close() { await state.nativeCapture!.stop(); clearInterval(state.ping); },
  };
}
