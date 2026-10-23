import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
export async function verifyNativeDocuments(
  session: { fetch(url: string, options?: RequestInit): Promise<Response> },
  root: string,
  origin: string,
) {
  const { createNativeDocumentImport } = createRequire(import.meta.url)(
    join(root, "../desktop/runtime.cjs"),
  ) as typeof import("../../packages/desktop/index.ts");
  const importer = createNativeDocumentImport({
    choose: async () => ({
      canceled: false,
      filePaths: [
        join(root, "tests/fixtures/reference.pdf"),
        join(root, "tests/fixtures/reference.docx"),
      ],
    }),
    locale: () => "en",
    signal: new AbortController().signal,
    request: (route, options) =>
      session.fetch(origin + route, {
        ...options,
        headers: {
          ...Object.fromEntries(new Headers(options.headers)),
          Origin: origin,
          Authorization: `Bearer ${process.env.CADENCE_LOCAL_TOKEN!}`,
        },
      }),
  });
  const result = await importer();
  assert.equal(result.length, 2);
  assert.ok(
    result.every((document) =>
      document.text.includes("Cadence migration fixture"),
    ),
  );
  assert.deepEqual(
    result.map((document) => document.name),
    ["reference.pdf", "reference.docx"],
  );
}
