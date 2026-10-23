import { expect, test } from "bun:test";
import { pcmWave } from "../../../client/studio/wave.ts";
import { validatePcmWave } from "../../packages/local-models/wave.ts";
import { readFile } from "node:fs/promises";

test("recorded audio downmixes to PCM mono while keeping realtime configuration independent", async () => {
  let closed = false;
  const context = { async decodeAudioData() {
    return { length: 4, sampleRate: 16000, numberOfChannels: 2,
      getChannelData(channel: number) { return Float32Array.from(channel ? [-1, 0.5, 1, 0] : [1, 0.5, -1, 0]); } };
  }, async close() { closed = true; } };
  const audio = await pcmWave(new Blob(["synthetic encoded recording"]), () => context as unknown as AudioContext);
  const bytes = new Uint8Array(await audio.arrayBuffer());
  expect(() => validatePcmWave(bytes)).not.toThrow();
  expect(new DataView(bytes.buffer).getInt16(44, true)).toBe(0);
  expect(new DataView(bytes.buffer).getInt16(46, true)).toBe(16384);
  expect(closed).toBe(true);
  const realtime = await readFile(new URL("../../../client/realtime/browser.ts", import.meta.url), "utf8");
  const recorded = await readFile(new URL("../../../client/studio/wave.ts", import.meta.url), "utf8");
  expect(realtime).toContain("sampleRate: 24000");
  expect(recorded).toContain("sampleRate: 16000");
});
test("decode failure closes the recording conversion context", async () => {
  let closed = false;
  const context = { async decodeAudioData() { throw Error("malformed audio"); }, async close() { closed = true; } };
  await expect(pcmWave(new Blob(["broken"]), () => context as unknown as AudioContext)).rejects.toThrow("malformed audio");
  expect(closed).toBe(true);
});
