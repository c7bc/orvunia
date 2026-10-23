import { z } from "zod";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const speechQualificationSchema = z.object({
  synthetic: z.literal(true), outputDeviceOpened: z.literal(false),
  cleanMaximumWer: z.literal(0.25), noisyMaximumWer: z.literal(0.35),
  sources: z.array(z.object({ id: z.string().min(1), engine: z.string().min(1), version: z.string().min(1),
    voice: z.string().min(1), provenance: z.string().min(1) }).strict()).min(3).max(12),
  fixtures: z.array(z.object({ id: z.string().min(1), sourceId: z.string().min(1),
    language: z.enum(["pt", "en", "es"]), condition: z.enum(["clean", "noisy"]),
    reference: z.string().min(1).max(2048), file: z.string().regex(/^[a-z0-9-]+\.wav$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/), noiseSnrDb: z.number().optional() }).strict()).min(6).max(24),
}).strict();
export type SpeechQualification = z.infer<typeof speechQualificationSchema>;

export async function loadSpeechQualification(directory: string) {
  const metadata = await readFile(join(directory, "qualification.json"));
  const manifest = speechQualificationSchema.parse(JSON.parse(metadata.toString("utf8")));
  const sourceIds = new Set(manifest.sources.map((source) => source.id));
  const fixtureIds = new Set<string>();
  for (const fixture of manifest.fixtures) {
    if (!sourceIds.has(fixture.sourceId) || fixtureIds.has(fixture.id)) throw new Error("invalid_fixture_identity");
    fixtureIds.add(fixture.id);
    const audio = await readFile(join(directory, fixture.file));
    if (createHash("sha256").update(audio).digest("hex") !== fixture.sha256) throw new Error("fixture_hash_mismatch");
  }
  for (const language of ["pt", "en", "es"]) {
    const selected = manifest.fixtures.filter((fixture) => fixture.language === language);
    const engines = new Set(selected.map((fixture) => manifest.sources.find((source) => source.id === fixture.sourceId)!.engine));
    if (engines.size < 2 || ["clean", "noisy"].some((condition) => !selected.some((fixture) => fixture.condition === condition)))
      throw new Error("insufficient_independent_coverage");
  }
  return { manifest, sha256: createHash("sha256").update(metadata).digest("hex") };
}
