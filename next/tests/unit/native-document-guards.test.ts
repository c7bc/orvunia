import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createNativeDocumentImport } from "../../packages/desktop/documents.ts";
test("cancelled native selection and application shutdown never upload a document", async () => {
  const controller = new AbortController();
  let uploads = 0,
    entered!: () => void,
    release!: () => void;
  const opened = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const request = async (route: string) => {
    if (route === "/api/import") uploads++;
    return Response.json({ workspaceId: "a".repeat(24) });
  };
  const cancelled = createNativeDocumentImport({
    request,
    locale: () => "en",
    signal: controller.signal,
    choose: async () => ({ canceled: true, filePaths: [] }),
  });
  expect(await cancelled()).toEqual([]);
  const closing = createNativeDocumentImport({
    request,
    locale: () => "en",
    signal: controller.signal,
    choose: async () => {
      entered();
      await waiting;
      return { canceled: false, filePaths: ["never-read-private-file"] };
    },
  });
  const running = closing().catch((error: unknown) => error);
  await opened;
  controller.abort();
  release();
  expect(await running).toMatchObject({ name: "AbortError" });
  expect(uploads).toBe(0);
});
test("a failed native import cancels the other request in its bounded batch", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "cadence-native-document-batch-"),
  );
  const first = join(directory, "first.txt"),
    second = join(directory, "second.txt");
  await writeFile(first, "First synthetic reference");
  await writeFile(second, "Second synthetic reference");
  let secondStarted!: () => void,
    aborted = 0;
  const secondReady = new Promise<void>((resolve) => {
    secondStarted = resolve;
  });
  const importer = createNativeDocumentImport({
    locale: () => "en",
    signal: new AbortController().signal,
    choose: async () => ({ canceled: false, filePaths: [first, second] }),
    async request(route, options) {
      if (route.startsWith("/api/bootstrap"))
        return Response.json({ workspaceId: "b".repeat(24) });
      const file = (options.body as FormData).get("file") as File;
      expect(new Headers(options.headers).get("x-cadence-workspace")).toBe(
        "b".repeat(24),
      );
      if (file.name === "first.txt") {
        await secondReady;
        return Response.json(
          { error: { code: "invalid_document" } },
          { status: 415 },
        );
      }
      secondStarted();
      return new Promise<Response>((_resolve, reject) => {
        options.signal!.addEventListener(
          "abort",
          () => {
            aborted++;
            reject(new DOMException("Interrupted", "AbortError"));
          },
          { once: true },
        );
      });
    },
  });
  try {
    await expect(importer()).rejects.toThrow("unsupported");
    expect(aborted).toBe(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("oversized native documents fail before sending file bytes to the backend", async () => {
  const directory = await mkdtemp(
      join(tmpdir(), "cadence-native-document-size-"),
    ),
    filename = join(directory, "large.txt");
  await writeFile(filename, Buffer.alloc(5 * 1024 * 1024 + 1));
  let uploads = 0;
  try {
    const importer = createNativeDocumentImport({
      locale: () => "en",
      signal: new AbortController().signal,
      choose: async () => ({ canceled: false, filePaths: [filename] }),
      async request(route) {
        if (route === "/api/import") uploads++;
        return Response.json({ workspaceId: "c".repeat(24) });
      },
    });
    await expect(importer()).rejects.toThrow("up to 5 MB");
    expect(uploads).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
