export function speechWords(value: string): string[] {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}
export function wordErrorRate(reference: string, hypothesis: string) {
  const expected = speechWords(reference); const actual = speechWords(hypothesis);
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let row = 1; row <= expected.length; row++) {
    const current = [row];
    for (let column = 1; column <= actual.length; column++) {
      current[column] = Math.min(previous[column]! + 1, current[column - 1]! + 1,
        previous[column - 1]! + (expected[row - 1] === actual[column - 1] ? 0 : 1));
    }
    previous = current;
  }
  const edits = previous[actual.length]!;
  return { edits, referenceWords: expected.length, hypothesisWords: actual.length,
    wer: expected.length ? edits / expected.length : actual.length ? 1 : 0 };
}
export function silenceWave(seconds = 3): Uint8Array {
  const length = seconds * 32000; const bytes = Buffer.alloc(44 + length);
  bytes.write("RIFF"); bytes.writeUInt32LE(36 + length, 4); bytes.write("WAVE", 8); bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(16000, 24);
  bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(length, 40);
  return bytes;
}
