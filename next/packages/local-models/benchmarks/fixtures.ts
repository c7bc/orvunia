import { createHash } from "node:crypto";
import type { Capability } from "../domain.ts";
import * as portuguese from "./audio-pt.ts";
import * as english from "./audio-en.ts";
import * as spanish from "./audio-es.ts";
import { imageBase64, imageSha256 } from "./image.ts";

export type BenchmarkFixture = {
  id: string;
  capability: Capability;
  language: "pt" | "en" | "es" | null;
  sha256: string;
  bytes: Uint8Array;
  prompt: string;
  reference: string;
};
const textPrompt = "Return only a JSON array containing the distinct numbers from [3,1,3,2,1], preserving first appearance order.";
export const fixtureVersion = "2026-10-20.1";
export function benchmarkFixtures(capabilities: readonly Capability[]): BenchmarkFixture[] {
  const fixtures: BenchmarkFixture[] = [];
  if (capabilities.includes("text")) {
    const bytes = Buffer.from(textPrompt);
    fixtures.push({ id: "distinct-numbers", capability: "text", language: null,
      sha256: createHash("sha256").update(bytes).digest("hex"), bytes, prompt: textPrompt, reference: "[3,1,2]" });
  }
  if (capabilities.includes("vision")) fixtures.push({ id: "code-map-array", capability: "vision", language: null,
    sha256: imageSha256, bytes: Buffer.from(imageBase64, "base64"), reference: "[4,8,12]",
    prompt: "Read and execute the JavaScript code in the image. Return only the JSON array printed by console.log." });
  if (capabilities.includes("transcription")) {
    for (const [language, audio] of [["pt", portuguese], ["en", english], ["es", spanish]] as const)
      fixtures.push({ id: `espeak-${language}`, capability: "transcription", language, sha256: audio.audioSha256,
        bytes: Buffer.from(audio.audioBase64, "base64"), reference: audio.reference, prompt: "" });
  }
  return fixtures;
}
