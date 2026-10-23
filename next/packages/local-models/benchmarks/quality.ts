import type { BenchmarkCase } from "./types.ts";

function words(value: string): string[] {
  return value.normalize("NFC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}
export function wordErrorRate(reference: string, output: string): number {
  const expected = words(reference);
  const actual = words(output);
  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let row = 1; row <= expected.length; row++) {
    const current = [row];
    for (let column = 1; column <= actual.length; column++) current[column] = Math.min(
      previous[column]! + 1, current[column - 1]! + 1,
      previous[column - 1]! + (expected[row - 1] === actual[column - 1] ? 0 : 1));
    previous = current;
  }
  return previous[actual.length]! / Math.max(1, expected.length);
}
export function benchmarkQuality(capability: string, reference: string, output: string): BenchmarkCase["quality"] {
  if (capability === "transcription") {
    const value = wordErrorRate(reference, output);
    const expected = words(reference);
    const actual = words(output);
    const count = (tokens: string[], word: string) => tokens.filter(candidate => candidate === word).length;
    const polarity = ["não", "not", "no", "never", "nunca", "sem", "sin", "indisponível", "unavailable", "indisponible"];
    const criticalTermsPreserved = polarity.every(word => count(actual, word) === count(expected, word))
      && ["python", "sql"].every(word => count(actual, word) >= count(expected, word));
    return { metric: "wer", value, maximum: 0.25, criticalTermsPreserved,
      passed: value <= 0.25 && criticalTermsPreserved };
  }
  let matches = false;
  try { matches = JSON.stringify(JSON.parse(output.trim())) === reference; } catch { /* Invalid JSON is a failed task. */ }
  return { metric: "exact-array", value: matches ? 0 : 1, maximum: 0, passed: matches, criticalTermsPreserved: null };
}
