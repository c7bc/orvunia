import { expect, test } from "bun:test";
import { systemAudioFixture } from "../support/system-audio-fixture.ts";
import { captureNativeRealtime } from "../../../client/system-audio/realtime.ts";
import { RealtimeAudio } from "../../../client/realtime/recorder.ts";
import { StudioAudio } from "../../../client/studio/index.ts";
import type { RealtimePlatform } from "../../../client/realtime/contracts.ts";

async function environment() {
  const native = systemAudioFixture();
  const bridge = { systemAudio: (value: unknown) => native.manager.invoke(12, value),
    onEvent: (listener: (value: unknown) => void) => native.subscribe(data => listener({ type: "system-audio", data })) };
  let open = true, failSend = false;
  const sent: unknown[] = [];
  const socket = { bufferedAmount: 0, close() { open = false; }, send(value: unknown) {
    if (failSend) throw Error("Controlled send failure");
    sent.push(value);
    if (typeof value === "string") {
      const message = JSON.parse(value);
      if (message.type === "commit") queueMicrotask(() => { state.pending = Math.max(0, state.pending - 1); });
      if (message.type === "flush") queueMicrotask(() => state.waiters.get("server:" + message.id)?.resolve());
    }
  } };
  const forbidden = () => { throw Error("Browser acquisition forbidden"); };
  const platform: RealtimePlatform = { native: bridge, request: forbidden, socket: forbidden, acquire: forbidden,
    context: forbidden, stream: forbidden, processor: forbidden, open: () => open,
    clock: () => Date.now(), identifier: () => crypto.randomUUID() };
  const state = new RealtimeAudio(platform); state.ws = socket as unknown as WebSocket; state.supportsFlush = true;
  await captureNativeRealtime(state, bridge, state.ws, () => {}, { sessionId: crypto.randomUUID(), time: () => "00:01" });
  const audio = new StudioAudio({ chunk: forbidden, realtime: () => state, wave: async blob => blob });
  audio.channels.set("system", state);
  return { native, state, audio, sent, socket, close() { open = false; }, failSend() { failSend = true; } };
}

test("skipped idle zeros create no shutdown debt, and zero tail after speech is included in its final flush", async () => {
  const context = await environment();
  context.native.data(new Uint8Array(960));
  expect(context.state.confirmation.sent).toBe(0);
  context.native.data(new Uint8Array([8, 0, 8, 0]));
  context.native.data(new Uint8Array(960));
  expect(context.state.confirmation.sent).toBe(1924);
  await context.state.flush({ timeoutMs: 1000 });
  context.native.data(new Uint8Array(960));
  expect(context.state.confirmation.sent).toBe(4800);
  context.state.error = Error("Historical operational error");
  await context.audio.stopConfirmed();
  expect(context.state.shutdownError).toBeNull();
  expect(context.state.error).toBeInstanceOf(Error);
});

test("a purely silent native capture can quit after its socket closes without fabricating audio debt", async () => {
  const context = await environment();
  context.native.data(new Uint8Array(960)); context.close();
  context.native.data(new Uint8Array(960));
  await context.audio.stopConfirmed();
  expect(context.state.shutdownError).toBeNull();
});

for (const reason of ["closed", "backpressure", "send-throws"] as const)
  test(`captured speech that cannot be sent due to ${reason} remains a shutdown barrier`, async () => {
    const context = await environment();
    if (reason === "closed") context.close();
    if (reason === "backpressure") context.socket.bufferedAmount = 480001;
    if (reason === "send-throws") context.failSend();
    context.native.data(new Uint8Array([8, 0, 8, 0]));
    await context.state.stop();
    expect(context.state.confirmation.sent).toBe(0);
    expect(context.state.shutdownError).toBeInstanceOf(Error);
    await expect(context.audio.stopConfirmed()).rejects.toThrow("Uma fala ficou sem confirmação");
  });

test("server quota errors survive late PCM arriving after the socket closes", async () => {
  const context = await environment();
  const failure = Error("A cota de transcrição foi atingida.");
  context.state.error = failure;
  context.close();
  context.native.data(new Uint8Array([8, 0, 8, 0]));
  await context.state.stop();
  expect(context.state.error).toBe(failure);
  expect(context.state.confirmation.failure?.message).toBe(failure.message);
});

test("late native packets after an intentionally cancelled capture cannot create a new shutdown debt", async () => {
  const context = await environment();
  context.state.starting = true; context.state.stopping = true;
  context.native.data(new Uint8Array([1, 0, 1, 0]));
  await context.state.nativeCapture!.stop(); clearInterval(context.state.ping);
  context.native.data(new Uint8Array([1, 0, 1, 0]));
  expect(context.state.confirmation.sent).toBe(0);
  expect(context.state.shutdownError).toBeNull();
});
