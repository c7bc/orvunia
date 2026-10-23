import { expect, test } from "bun:test";
import { StudioAudio } from "../../../client/studio/index.ts";
import { pcmWave } from "../../../client/studio/wave.ts";
import type {
  StudioPlatform,
  ChunkChannel,
} from "../../../client/studio/contracts.ts";
function pending() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const settings = {
  realtime: false,
  sessionId: "synthetic",
  time: () => "00:00",
};
const callbacks = [() => {}, () => {}, () => {}] as const;
test("two requests to start the same source share acquisition and cancellation cannot reactivate a removed channel", async () => {
  const grant = pending();
  let created = 0,
    stops = 0;
  const channel: ChunkChannel = {
    running: false,
    async start() {
      await grant.promise;
      this.running = true;
    },
    async stop() {
      stops++;
      this.running = false;
    },
    async flush() {},
  };
  const platform: StudioPlatform = {
    chunk() {
      created++;
      return channel;
    },
    realtime() {
      throw Error("No realtime expected");
    },
    wave: async (blob) => blob,
  };
  const audio = new StudioAudio(platform);
  const first = audio.start("microphone", settings, ...callbacks);
  expect(audio.start("microphone", settings, ...callbacks)).toBe(first);
  const result = first.catch((error: unknown) => error);
  expect(created).toBe(1);
  await audio.stop();
  grant.resolve();
  expect(((await result) as DOMException).name).toBe("AbortError");
  expect(stops).toBe(2);
  expect(audio.running).toBe(false);
  expect(audio.channels.size).toBe(0);
});
test("an older stop cannot erase a newly started audio source while it finishes draining", async () => {
  const drain = pending();
  let index = 0;
  const channels = [
    {
      running: true,
      start: async () => {},
      stop: () => drain.promise,
      flush: async () => {},
    },
    {
      running: true,
      start: async () => {},
      stop: async () => {},
      flush: async () => {},
    },
  ];
  const audio = new StudioAudio({
    chunk: () => channels[index++]!,
    realtime: () => {
      throw Error("Unused");
    },
    wave: async (blob) => blob,
  });
  await audio.start("microphone", settings, ...callbacks);
  const stopping = audio.stop("microphone");
  await audio.start("microphone", settings, ...callbacks);
  drain.resolve();
  await stopping;
  expect(audio.channels.get("microphone")).toBe(channels[1]);
  expect(audio.running).toBe(true);
  await audio.stop();
});
test("PCM conversion retains the actual sample rate, mixes stereo, clips signed samples and closes the temporary graph", async () => {
  let closed = 0;
  const context = {
    decodeAudioData: async () => ({
      length: 3,
      sampleRate: 24000,
      numberOfChannels: 2,
      getChannelData: () => new Float32Array([0.5, -2, 2]),
    }),
    close: async () => {
      closed++;
    },
  };
  const result = await pcmWave(
    new Blob(["synthetic"]),
    () => context as unknown as AudioContext,
  );
  const bytes = await result.arrayBuffer();
  const view = new DataView(bytes);
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
  expect(result.type).toBe("audio/wav");
  expect(view.getUint16(22, true)).toBe(1);
  expect(view.getUint32(24, true)).toBe(24000);
  expect([44, 46, 48].map((offset) => view.getInt16(offset, true))).toEqual([
    16384, -32768, 32767,
  ]);
  expect(closed).toBe(1);
});
