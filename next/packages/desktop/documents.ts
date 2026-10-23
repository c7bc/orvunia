import { basename } from "node:path";
import { lstat } from "node:fs/promises";
import { z } from "zod";
import { readPrivateFile } from "../providers/private-file.ts";
import { nativeDocumentMessage } from "./document-messages.ts";
const bootstrap = z.object({ workspaceId: z.string().regex(/^[a-f0-9]{24}$/) });
const document = z
  .object({
    name: z.string().min(1).max(1000),
    text: z.string().min(1).max(30000),
  })
  .strict();
export function createNativeDocumentImport(ports: {
  choose(): Promise<{ canceled: boolean; filePaths: string[] }>;
  request(path: string, options: RequestInit): Promise<Response>;
  signal: AbortSignal;
  locale(): string;
}) {
  async function importFile(
    filename: string,
    workspace: string,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const info = await lstat(filename).catch(() => null);
    if (info && info.size > 5 * 1024 * 1024)
      throw Error(nativeDocumentMessage("size", ports.locale()));
    let bytes: Buffer;
    try {
      bytes = await readPrivateFile(filename, 5 * 1024 * 1024);
    } catch {
      throw Error(nativeDocumentMessage("unavailable", ports.locale()));
    }
    signal.throwIfAborted();
    const body = new FormData();
    body.append("file", new Blob([new Uint8Array(bytes)]), basename(filename));
    const response = await ports.request("/api/import", {
      method: "POST",
      body,
      credentials: "include",
      redirect: "error",
      signal,
      headers: {
        "X-Cadence-Workspace": workspace,
        "X-Cadence-Request": "1",
        "Accept-Language": ports.locale(),
      },
    });
    if (!response.ok)
      throw Error(
        nativeDocumentMessage(
          response.status === 401 || response.status === 409
            ? "changed"
            : "invalid",
          ports.locale(),
        ),
      );
    const result = document.safeParse(await response.json());
    signal.throwIfAborted();
    if (!result.success)
      throw Error(nativeDocumentMessage("unavailable", ports.locale()));
    return result.data;
  }
  async function run(signal: AbortSignal) {
    signal.throwIfAborted();
    const response = await ports.request("/api/bootstrap?compact=1", {
      method: "GET",
      credentials: "include",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok)
      throw Error(nativeDocumentMessage("unavailable", ports.locale()));
    const checked = bootstrap.safeParse(await response.json());
    if (!checked.success)
      throw Error(nativeDocumentMessage("unavailable", ports.locale()));
    const selected = await ports.choose();
    signal.throwIfAborted();
    if (selected.canceled) return [];
    const results: z.infer<typeof document>[] = [];
    for (
      let offset = 0;
      offset < Math.min(selected.filePaths.length, 15);
      offset += 2
    ) {
      const batch = selected.filePaths.slice(offset, Math.min(offset + 2, 15));
      results.push(
        ...(await Promise.all(
          batch.map((filename) =>
            importFile(
              filename,
              checked.data.workspaceId,
              AbortSignal.any([signal, AbortSignal.timeout(30000)]),
            ),
          ),
        )),
      );
    }
    return results;
  }
  return async function importDocuments() {
    const controller = new AbortController();
    try {
      return await run(AbortSignal.any([ports.signal, controller.signal]));
    } finally {
      controller.abort();
    }
  };
}
