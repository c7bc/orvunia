import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { verifyRuntimeFile } from "../../packages/desktop/runtime-file.ts";
test("runtime verification rejects changed bytes, directories and cancellation before launch", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-runtime-integrity-")),
    executable = join(directory, "synthetic-runtime"),
    bytes = "synthetic verified runtime";
  try {
    await writeFile(executable, bytes, { mode: 0o600 });
    const hash = createHash("sha256").update(bytes).digest("hex"),
      signal = new AbortController().signal;
    expect(await verifyRuntimeFile(executable, hash, signal)).toBe(executable);
    await writeFile(executable, bytes + "changed");
    await expect(verifyRuntimeFile(executable, hash, signal)).rejects.toThrow(
      "integrity",
    );
    await expect(verifyRuntimeFile(directory, hash, signal)).rejects.toThrow(
      "regular bundled file",
    );
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      verifyRuntimeFile(executable, hash, aborted.signal),
    ).rejects.toBeDefined();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
