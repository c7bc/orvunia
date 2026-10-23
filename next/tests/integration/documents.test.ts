import { expect, test } from "bun:test";
import { extractText } from "../../packages/assets/extract.ts";

test("Bun extracts known synthetic PDF and DOCX documents", async () => {
  for (const extension of ["pdf", "docx"]) {
    const file = Buffer.from(
      await Bun.file(
        new URL(`../fixtures/reference.${extension}`, import.meta.url),
      ).arrayBuffer(),
    );
    expect(await extractText(file, `reference.${extension}`)).toContain(
      "Cadence migration fixture",
    );
  }
});
test("document extraction rejects unexpected types, signatures and oversized input", async () => {
  await expect(
    extractText(Buffer.from("not a PDF"), "reference.pdf"),
  ).rejects.toThrow("invalid_document");
  await expect(
    extractText(Buffer.from("not a DOCX"), "reference.docx"),
  ).rejects.toThrow("invalid_document");
  await expect(
    extractText(Buffer.from("script"), "program.exe"),
  ).rejects.toThrow("unsupported_document");
  await expect(
    extractText(Buffer.alloc(5 * 1024 * 1024 + 1), "reference.txt"),
  ).rejects.toThrow("document_too_large");
  expect(
    await extractText(Buffer.from("Text\0 content"), "reference.txt"),
  ).toBe("Text content");
});
