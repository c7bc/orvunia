import { extname } from "node:path";
import { runDocumentProcess } from "./document-process.ts";

function documentFormat(buffer: Buffer, name: string) {
  if (buffer.length > 5 * 1024 * 1024) throw Error("document_too_large");
  const extension = extname(name).toLowerCase();
  if (extension === ".pdf") {
    if (buffer.subarray(0, 5).toString() !== "%PDF-")
      throw Error("invalid_document");
  } else if (extension === ".docx") {
    if (buffer.subarray(0, 2).toString() !== "PK")
      throw Error("invalid_document");
  } else if (
    ![
      ".txt",
      ".md",
      ".json",
      ".csv",
      ".ts",
      ".js",
      ".py",
      ".java",
      ".cpp",
      ".go",
      ".rs",
      ".sql",
      ".kt",
      ".cs",
      ".rb",
    ].includes(extension)
  )
    throw Error("unsupported_document");
  return extension;
}

function normalized(text: string) {
  text = text.replaceAll("\0", "").trim();
  if (!text) throw Error("empty_document");
  return text.slice(0, 30_000);
}

export function documentExtractor(execute = runDocumentProcess) {
  const active = new Map<AbortController, Promise<string>>();
  let closing: Promise<void> | null = null;
  return {
    async extract(buffer: Buffer, name: string, signal?: AbortSignal) {
      if (closing) throw Error("invalid_document");
      signal?.throwIfAborted();
      const format = documentFormat(buffer, name);
      if (format !== ".pdf" && format !== ".docx")
        return normalized(buffer.toString("utf8"));
      if (active.size >= 2) throw Error("document_busy");
      const controller = new AbortController();
      const task = Promise.resolve().then(() =>
        execute(
          buffer,
          format,
          signal
            ? AbortSignal.any([signal, controller.signal])
            : controller.signal,
        ),
      );
      active.set(controller, task);
      try {
        const text = await task;
        if (closing) throw Error("invalid_document");
        signal?.throwIfAborted();
        return normalized(text);
      } finally {
        active.delete(controller);
      }
    },
    close() {
      if (closing) return closing;
      closing = (async () => {
        for (const controller of active.keys()) controller.abort();
        await Promise.allSettled(active.values());
      })();
      return closing;
    },
  };
}

export type DocumentExtractor = ReturnType<typeof documentExtractor>;

export async function extractText(buffer: Buffer, name: string) {
  const extractor = documentExtractor();
  try {
    return await extractor.extract(buffer, name);
  } finally {
    await extractor.close();
  }
}
