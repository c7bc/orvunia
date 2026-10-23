import { expect, test } from "bun:test";
import { captureNativePcm } from "../../../client/system-audio/capture.ts";
import { NativeChunkRecorder } from "../../../client/system-audio/chunk.ts";
import { captureNativeRealtime } from "../../../client/system-audio/realtime.ts";
import { RealtimeAudio } from "../../../client/realtime/recorder.ts";
import type { RealtimePlatform } from "../../../client/realtime/contracts.ts";
import { syntheticEndpoint, systemAudioFixture } from "../support/system-audio-fixture.ts";

function fixture() {
  const native = systemAudioFixture();
  const bridge = { systemAudio: (value: unknown) => native.manager.invoke(12, value),
    onEvent: (listener: (value: unknown) => void) => native.subscribe((data) => listener({ type: "system-audio", data })) };
  return { ...native, bridge };
}

test("renderer/native boundary delivers PCM before flush receipt and preserves selected output", async () => {
  const native = fixture();
  const frames: number[][] = [];
  const capture = await captureNativePcm(native.bridge, { sessionId: crypto.randomUUID(), endpointId: syntheticEndpoint,
    identifier: () => crypto.randomUUID(), frame: (data) => { frames.push([...data]); }, ended() {} });
  expect(native.commands[0]?.endpointId).toBe(syntheticEndpoint);
  native.flushTarget(2);
  let done = false;
  const flushing = capture.flush({ timeoutMs: 1000 }).then(() => { done = true; });
  await Bun.sleep(1); expect(done).toBe(false);
  native.data(new Uint8Array([1, 0, 2]));
  native.data(new Uint8Array([0]));
  await flushing;
  expect(frames.flat()).toEqual([1, 0, 2, 0]);
  await capture.stop();
  expect(native.commands.at(-1)?.command).toBe("stop");
});

test("abort during pending ready closes helper before capture startup can continue", async () => {
  const native = fixture(); native.ready(false);
  const controller = new AbortController();
  const pending = captureNativePcm(native.bridge, { sessionId: crypto.randomUUID(), endpointId: syntheticEndpoint,
    identifier: () => crypto.randomUUID(), signal: controller.signal, frame() {}, ended() {} }).catch((error: Error) => error);
  controller.abort();
  const error = await pending;
  expect(error).toBeInstanceOf(Error);
  expect(native.commands.map((item) => item.command)).toEqual(["start", "stop"]);
  expect(native.events.at(-1)?.type).toBe("ended");
});

test("chunk capture produces PCM WAV and waits for asynchronous transcription on stop", async () => {
  const native = fixture(), recorder = new NativeChunkRecorder(native.bridge);
  const chunks: Blob[] = [];
  let release!: () => void;
  const delivery = new Promise<void>((resolve) => { release = resolve; });
  await recorder.start("display", async (blob) => { chunks.push(blob); await delivery; }, () => {},
    { sessionId: crypto.randomUUID(), device: syntheticEndpoint });
  native.data(new Uint8Array([255, 127, 0, 128]));
  let stopped = false;
  const stop = recorder.stop().then(() => { stopped = true; });
  await Bun.sleep(1); expect(stopped).toBe(false);
  release(); await stop;
  expect(chunks).toHaveLength(1);
  const buffer = await chunks[0]!.arrayBuffer(), view = new DataView(buffer);
  expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe("RIFF");
  expect(view.getUint32(24, true)).toBe(24000);
  expect(view.getUint16(22, true)).toBe(1);
  expect([...new Uint8Array(buffer.slice(44))]).toEqual([255, 127, 0, 128]);
});

test("chunk stop cancels native startup without waiting for ready timeout", async () => {
  const native = fixture(); native.ready(false);
  const recorder = new NativeChunkRecorder(native.bridge);
  const pending = recorder.start("display", () => {}, () => {}, { sessionId: crypto.randomUUID() }).catch((error: Error) => error);
  await recorder.stop();
  expect(await pending).toBeInstanceOf(Error);
  expect(recorder.running).toBe(false);
  expect(native.commands.map((item) => item.command)).toEqual(["start", "stop"]);
});

test("realtime sends low volume PCM continuously with no browser media acquisition", async () => {
  const native = fixture(), sent: unknown[] = [];
  const socket = { bufferedAmount: 0, send(value: unknown) { sent.push(value); } } as WebSocket;
  const forbidden = () => { throw Error("Browser acquisition is forbidden in this test"); };
  const platform: RealtimePlatform = { native: native.bridge, request: forbidden, socket: forbidden,
    acquire: forbidden, context: forbidden, stream: forbidden, processor: forbidden,
    open: () => true, clock: () => Date.now(), identifier: () => crypto.randomUUID() };
  const state = new RealtimeAudio(platform);
  await captureNativeRealtime(state, native.bridge, socket, () => {}, {
    sessionId: crypto.randomUUID(), device: syntheticEndpoint, time: () => "00:01" });
  native.data(new Uint8Array(960));
  expect(sent).toHaveLength(0);
  expect(state.confirmation.sent).toBe(0);
  native.data(new Uint8Array([8, 0, 8, 0]));
  expect(sent).toHaveLength(2);
  expect([...new Uint8Array(sent[1] as ArrayBuffer)]).toEqual([8, 0, 8, 0]);
  expect(state.signal?.sentSamples).toBe(482);
  expect(state.signal?.receivedSamples).toBe(482);
  native.data(new Uint8Array(960));
  expect(sent).toHaveLength(3);
  expect(state.confirmation.sent).toBe(1924);
  await state.nativeCapture!.flush({ timeoutMs: 1000 });
  native.data(new Uint8Array(960));
  expect(sent).toHaveLength(5);
  expect(state.confirmation.sent).toBe(4800);
  expect(JSON.parse(String(sent.at(-1))).utteranceId).toMatch(/^[a-f0-9-]{36}$/);
  expect(state.signal?.receivedSamples).toBe(1442);
  await state.nativeCapture!.stop(); clearInterval(state.ping);
  expect(native.commands[0]?.endpointId).toBe(syntheticEndpoint);
});
