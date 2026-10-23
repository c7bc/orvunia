import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { SpeechActivity } from "../../../client/audio/speech-activity.ts";

function fixture() {
  const messages: { type: string; end?: boolean; data?: ArrayBuffer }[] = [];
  type Processor = { speech: SpeechActivity; process(input: Float32Array[][], output: never[]): void;
    port: { onmessage(event: { data: unknown }): void } };
  let ProcessorClass!: new (options: unknown) => Processor;
  class Base { port = { postMessage(value: typeof messages[number]) { messages.push(value); } }; }
  runInNewContext(readFileSync(new URL("../../../pcm-worklet.js", import.meta.url), "utf8"), {
    AudioWorkletProcessor: Base, sampleRate: 24000, Int16Array, Float32Array,
    registerProcessor(_name: string, constructor: typeof ProcessorClass) { ProcessorClass = constructor; },
  });
  const processor = new ProcessorClass({ processorOptions: { continuous: true } });
  const frame = (amplitude: number, sparse = false) => processor.process([[Float32Array.from({ length: 2400 }, (_, index) =>
    sparse ? (index === 0 ? Math.max(1 / 32768, amplitude) : 0) : amplitude * Math.sin(index * 0.11))]], []);
  return { processor, frame, messages };
}

test("isolated browser worklet and native acoustic classifier keep the same evidence and thresholds", () => {
  const current = fixture(), native = new SpeechActivity();
  for (let frame = 0; frame < 200; frame++) {
    const rms = frame < 30 ? 0.000001 : frame < 80 ? 0.00015 * (1 + 0.5 * Math.sin(frame)) : 0.000002;
    expect(current.processor.speech.observe(rms, 20, frame * 20)).toBe(native.observe(rms, 20, frame * 20));
    expect(current.processor.speech.threshold).toBe(native.threshold);
    expect(current.processor.speech.lastSpeechAt).toBe(native.lastSpeechAt);
  }
});

test("browser idle sparse noise stays local and creates no upload or commit", () => {
  const current = fixture();
  for (let frame = 0; frame < 200; frame++) current.frame(0, true);
  current.processor.port.onmessage({ data: { type: "flush", id: "controlled" } });
  expect(current.messages.some(message => message.type === "audio" || message.type === "commit")).toBe(false);
});

test("low browser background energy cannot bypass the energy threshold through a sparse peak", () => {
  const current = fixture();
  for (let frame = 0; frame < 100; frame++) current.frame(0.0005, true);
  current.processor.port.onmessage({ data: { type: "flush", id: "background" } });
  expect(current.messages.some(message => message.type === "audio" || message.type === "commit")).toBe(false);
});

test("quiet browser utterance preserves pre-roll and ends promptly with an explicit final boundary", () => {
  const current = fixture();
  for (let frame = 0; frame < 10; frame++) current.frame(0, true);
  for (let frame = 0; frame < 8; frame++) current.frame(0.0004 * (1 + 0.5 * Math.sin(frame)));
  for (let frame = 0; frame < 7; frame++) current.frame(0);
  const audio = current.messages.filter(message => message.type === "audio");
  expect(audio.length).toBeGreaterThanOrEqual(17);
  const commits = current.messages.filter(message => message.type === "commit");
  expect(commits).toHaveLength(1);
  expect(commits[0]!.end).toBe(true);
});
