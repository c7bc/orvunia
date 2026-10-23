import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { z } from "zod";

const result = z.object({ text: z.string().max(30_000) }).strict();
export function documentEnvironment(
  source: Record<string, string | undefined>,
) {
  const environment: Record<string, string> = {
    DO_NOT_TRACK: "1",
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
  };
  for (const key of [
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "TMP",
    "TEMP",
    "TMPDIR",
    "LANG",
  ])
    if (source[key]) environment[key] = source[key]!;
  return environment;
}
export async function runDocumentProcess(
  buffer: Buffer,
  extension: string,
  signal: AbortSignal,
  options: { entry?: string; timeoutMs?: number } = {},
) {
  signal.throwIfAborted();
  const entry =
    options.entry ??
    fileURLToPath(new URL("./document-child.ts", import.meta.url));
  const child = Bun.spawn(
    [
      process.execPath,
      "--smol",
      "--no-env-file",
      "--no-install",
      entry,
      extension,
    ],
    {
      stdin: buffer,
      stdout: "pipe",
      stderr: "ignore",
      env: documentEnvironment(process.env),
      cwd: dirname(entry),
    },
  );
  let cancelled = false;
  const stop = () => {
    cancelled = true;
    if (child.exitCode === null) child.kill("SIGKILL");
  };
  signal.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, options.timeoutMs ?? 10_000);
  if (signal.aborted) stop();
  const output = (async () => {
    const reader = child.stdout.getReader(),
      chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 240_000) {
          stop();
          throw Error("invalid_document");
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks).toString("utf8");
    } finally {
      reader.releaseLock();
    }
  })();
  try {
    const outcomes = await Promise.allSettled([output, child.exited]);
    signal.throwIfAborted();
    if (
      cancelled ||
      outcomes[0].status !== "fulfilled" ||
      outcomes[1].status !== "fulfilled" ||
      outcomes[1].value !== 0
    )
      throw Error("invalid_document");
    return result.parse(JSON.parse(outcomes[0].value)).text;
  } catch {
    throw Error("invalid_document");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}
