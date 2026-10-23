import { expect, test } from "bun:test";
import { pcmDuration } from "../../packages/transcription/duration.ts";
import { syntheticWav } from "../support/wav.ts";

test("cloud audio duration checks PCM structure, byte rate, declared bounds and the twelve-second cap", () => {
  expect(pcmDuration(syntheticWav())).toBe(1);
  expect(pcmDuration(syntheticWav(2))).toBe(2);
  expect(pcmDuration(syntheticWav(12))).toBe(12);
  expect(() => pcmDuration(syntheticWav(13))).toThrow("audio_duration_limit");
  for (const offset of [0, 4, 8, 16, 20, 22, 24, 28, 32, 34, 40]) {
    const bytes = syntheticWav();
    bytes[offset] = 255;
    expect(() => pcmDuration(bytes)).toThrow("invalid_audio");
  }
  expect(() => pcmDuration(syntheticWav().slice(0, -1))).toThrow(
    "invalid_audio",
  );
});
