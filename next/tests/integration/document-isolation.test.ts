import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDocumentProcess } from "../../packages/assets/document-process.ts";
import { extractText } from "../../packages/assets/extract.ts";
import { documentZip } from "../support/document-zip.ts";

const entry = fileURLToPath(
  new URL("../fixtures/document-probe.ts", import.meta.url),
);

test("parser timeout kills and reaps its exact child before returning a sanitized error", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-document-probe-"));
  const marker = join(directory, "pid");
  try {
    await expect(
      runDocumentProcess(
        Buffer.from(marker),
        ".wait",
        new AbortController().signal,
        { entry, timeoutMs: 500 },
      ),
    ).rejects.toThrow("invalid_document");
    const pid = Number(await readFile(marker, "utf8"));
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    if (!directory.startsWith(join(tmpdir(), "cadence-document-probe-")))
      throw Error("Unsafe test cleanup");
    await rm(directory, { recursive: true, force: true });
  }
});

test("output overflow and malformed child output are rejected without returning diagnostic content", async () => {
  for (const extension of [".overflow", ".bad"])
    await expect(
      runDocumentProcess(
        Buffer.alloc(0),
        extension,
        new AbortController().signal,
        { entry, timeoutMs: 2000 },
      ),
    ).rejects.toThrow("invalid_document");
  expect(
    await runDocumentProcess(
      Buffer.alloc(0),
      ".ok",
      new AbortController().signal,
      { entry },
    ),
  ).toBe("synthetic");
});

test("request cancellation terminates the parser instead of leaving an orphan", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-document-probe-"));
  const marker = join(directory, "pid"),
    request = new AbortController();
  const pending = runDocumentProcess(
    Buffer.from(marker),
    ".wait",
    request.signal,
    { entry },
  ).catch((error: unknown) => error);
  try {
    const deadline = Date.now() + 2000;
    while (!(await Bun.file(marker).exists()) && Date.now() < deadline)
      await Bun.sleep(10);
    const pid = Number(await readFile(marker, "utf8"));
    request.abort();
    expect(await pending).toMatchObject({ message: "invalid_document" });
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    request.abort();
    await pending;
    if (!directory.startsWith(join(tmpdir(), "cadence-document-probe-")))
      throw Error("Unsafe test cleanup");
    await rm(directory, { recursive: true, force: true });
  }
});

test("parser does not load a .env file beside its entrypoint", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-document-probe-"));
  try {
    const probe = join(directory, "probe.ts");
    await Bun.write(probe, Bun.file(entry));
    await Bun.write(
      join(directory, ".env"),
      "CADENCE_DOCUMENT_PROBE=synthetic-private-config",
    );
    expect(
      await runDocumentProcess(
        Buffer.alloc(0),
        ".environment",
        new AbortController().signal,
        { entry: probe },
      ),
    ).toBe("absent");
  } finally {
    if (!directory.startsWith(join(tmpdir(), "cadence-document-probe-")))
      throw Error("Unsafe test cleanup");
    await rm(directory, { recursive: true, force: true });
  }
});

test("DOCX preflight bounds actual DEFLATE output even when its directory lies about the expanded size", async () => {
  const bomb = documentZip([
    {
      name: "word/document.xml",
      body: Buffer.alloc(17 * 1024 * 1024, 65),
      declared: 1,
    },
  ]);
  expect(bomb.length).toBeLessThan(5 * 1024 * 1024);
  await expect(extractText(bomb, "compressed.docx")).rejects.toThrow(
    "invalid_document",
  );
  expect(
    await extractText(Buffer.from("API stays responsive"), "valid.txt"),
  ).toBe("API stays responsive");
});

test("DOCX preflight also bounds the combined expanded archive", async () => {
  const body = Buffer.alloc(12 * 1024 * 1024, 65);
  const bomb = documentZip(
    ["one", "two", "three"].map((name) => ({ name, body })),
  );
  await expect(extractText(bomb, "aggregate.docx")).rejects.toThrow(
    "invalid_document",
  );
});
