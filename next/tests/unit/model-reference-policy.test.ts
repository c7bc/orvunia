import { expect, test } from "bun:test";
import { CuratedCatalog } from "../../packages/local-models/catalog.ts";
import { permittedExternalURL } from "../../packages/desktop/external.ts";
const origin = "http://127.0.0.1:19928";

test("desktop opens only exact source and license references from its compiled model catalog", () => {
  const references = new Set(new CuratedCatalog().list().flatMap(model => [model.source, model.license.url]));
  for (const reference of references) {
    expect(permittedExternalURL(reference, origin, null)).toBe(new URL(reference).href);
    for (const suffix of ["?redirect=https://example.test", "#changed", "/other"])
      expect(() => permittedExternalURL(reference + suffix, origin, null)).toThrow();
  }
  for (const reference of ["https://huggingface.co/foreign/model", "https://github.com/foreign/LICENSE",
    "https://www.apache.org/foreign", "https://user:password@huggingface.co/ggerganov/whisper.cpp",
    "https://huggingface.co:8443/ggerganov/whisper.cpp", "http://huggingface.co/ggerganov/whisper.cpp"])
    expect(() => permittedExternalURL(reference, origin, null)).toThrow();
});
