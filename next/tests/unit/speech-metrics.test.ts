import { expect, test } from "bun:test";
import { speechWords, wordErrorRate, silenceWave } from "../support/speech-metrics.ts";
import { normalizeWhisperText } from "../../packages/local-models/whisper-text.ts";
import { validatePcmWave, isDigitalSilence } from "../../packages/local-models/wave.ts";

test("WER uses fixed Unicode case/punctuation normalization and keeps accents and technical terms", () => {
  expect(wordErrorRate("Python e SQL.", "python, E sql!").wer).toBe(0);
  expect(wordErrorRate("a b c d", "a x c d")).toMatchObject({ edits: 1, wer: 0.25 });
  expect(wordErrorRate("a b", "a b c")).toMatchObject({ edits: 1, wer: 0.5 });
  expect(wordErrorRate("a b", "a")).toMatchObject({ edits: 1, wer: 0.5 });
  expect(speechWords("requisição Python SQL")).toEqual(["requisição", "python", "sql"]);
  expect(wordErrorRate("requisição", "requisicao").wer).toBe(1);
});
test("only an entire Whisper blank-audio marker becomes empty, preserving legitimate surrounding text", () => {
  expect(normalizeWhisperText(" \n[BLANK_AUDIO]\n")).toBe("");
  expect(normalizeWhisperText("The string [BLANK_AUDIO] is a marker.")).toBe("The string [BLANK_AUDIO] is a marker.");
  expect(normalizeWhisperText("[Música]")).toBe("[Música]");
  expect(() => validatePcmWave(silenceWave())).not.toThrow();
});
test("digital-zero guard recognizes only exact zero PCM, preserving even one-bit audio and rejecting invalid files", () => {
  const audio = silenceWave(); expect(isDigitalSilence(audio)).toBe(true);
  audio[44] = 1; expect(isDigitalSilence(audio)).toBe(false);
  expect(() => isDigitalSilence(new Uint8Array(44))).toThrow("local_audio_invalid");
});
