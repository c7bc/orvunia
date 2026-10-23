import { expect, test } from "bun:test";
import { documentExtractor } from "../../packages/assets/extract.ts";
import { validateDocumentZip } from "../../packages/assets/document-zip.ts";
import { documentZip } from "../support/document-zip.ts";
import { documentEnvironment } from "../../packages/assets/document-process.ts";

test("parser environment does not inherit API secrets, preload flags or provider diagnostics", () => {
  expect(
    documentEnvironment({
      SystemRoot: "synthetic-system",
      TEMP: "synthetic-temp",
      OPENAI_API_KEY: "synthetic-private",
      CADENCE_AUTH_SECRET: "synthetic-private",
      DATABASE_URL: "synthetic-private",
      NODE_OPTIONS: "synthetic-preload",
      BUN_OPTIONS: "synthetic-flags",
      BUN_CONFIG_VERBOSE_FETCH: "curl",
    }),
  ).toEqual({
    SystemRoot: "synthetic-system",
    TEMP: "synthetic-temp",
    DO_NOT_TRACK: "1",
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
  });
});

test("parser concurrency is bounded and shutdown aborts both tasks before completing", async () => {
  let entered = 0,
    cancelled = 0;
  const extractor = documentExtractor(async (_buffer, _format, signal) => {
    entered++;
    return new Promise<string>((_resolve, reject) => {
      signal.addEventListener(
        "abort",
        () => {
          cancelled++;
          reject(new DOMException("Stopped", "AbortError"));
        },
        { once: true },
      );
    });
  });
  const first = extractor
    .extract(Buffer.from("%PDF-"), "first.pdf")
    .catch((error: unknown) => error);
  const second = extractor
    .extract(Buffer.from("PK"), "second.docx")
    .catch((error: unknown) => error);
  await expect(
    extractor.extract(Buffer.from("%PDF-"), "third.pdf"),
  ).rejects.toThrow("document_busy");
  await Bun.sleep(0);
  expect(entered).toBe(2);
  const stop = extractor.close();
  expect(extractor.close()).toBe(stop);
  await stop;
  expect(cancelled).toBe(2);
  expect(await first).toBeInstanceOf(DOMException);
  expect(await second).toBeInstanceOf(DOMException);
  await expect(
    extractor.extract(Buffer.from("text"), "later.txt"),
  ).rejects.toThrow("invalid_document");
});

test("a cancelled parser result cannot be accepted even if the transport ignores the abort", async () => {
  let complete = (_text: string) => {};
  const extractor = documentExtractor(
    () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
  );
  const request = new AbortController();
  const pending = extractor
    .extract(Buffer.from("%PDF-"), "late.pdf", request.signal)
    .catch((error: unknown) => error);
  await Bun.sleep(0);
  request.abort();
  complete("late content");
  expect(await pending).toBeInstanceOf(DOMException);
  await extractor.close();
});

test("archive preflight rejects duplicate paths, traversal, mismatched sizes and malformed directories", () => {
  const body = Buffer.from("small text");
  expect(() =>
    validateDocumentZip(documentZip([{ name: "word/document.xml", body }])),
  ).not.toThrow();
  for (const entries of [
    [{ name: "../outside", body }],
    [
      { name: "same", body },
      { name: "same", body },
    ],
    [{ name: "mismatch", body, declared: 1 }],
  ])
    expect(() => validateDocumentZip(documentZip(entries))).toThrow(
      "invalid_document",
    );
  expect(() => validateDocumentZip(Buffer.alloc(0))).toThrow(
    "invalid_document",
  );
});
