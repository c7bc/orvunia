import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { bundledRuntimes } from "../../packages/local-models/bundled.ts";

test("bundled runtimes verify auxiliary DLLs, executable membership, platform and paths before activation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-bundled-runtime-"));
  try {
    await mkdir(join(directory, "runtime"));
    const bytes = Buffer.from("Synthetic file. Never executed.");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    await writeFile(join(directory, "runtime/runner.exe"), bytes);
    await writeFile(join(directory, "runtime/library.dll"), bytes);
    const manifest = { format: "orvunia-model-runtimes/1", platform: process.platform, architecture: process.arch,
      files: [{ path: "runtime/runner.exe", sha256 }, { path: "runtime/library.dll", sha256 }],
      runtimes: { whisper: { path: "runtime/runner.exe", sha256, version: "synthetic" } } };
    const save = (value: unknown) => writeFile(join(directory, "manifest.json"), JSON.stringify(value));
    await save(manifest);
    expect((await bundledRuntimes(directory, true)).whisper?.path).toBe(join(directory, "runtime/runner.exe"));
    await writeFile(join(directory, "runtime/library.dll"), "Changed dependency");
    await expect(bundledRuntimes(directory, true)).rejects.toThrow("integrity");
    await writeFile(join(directory, "runtime/library.dll"), bytes);
    await save({ ...manifest, files: manifest.files.slice(1) });
    await expect(bundledRuntimes(directory, true)).rejects.toThrow("executable is not verified");
    await save({ ...manifest, runtimes: { whisper: { ...manifest.runtimes.whisper, path: "../escape.exe" } } });
    await expect(bundledRuntimes(directory, true)).rejects.toThrow();
    await save({ ...manifest, architecture: process.arch === "x64" ? "arm64" : "x64" });
    await expect(bundledRuntimes(directory, true)).rejects.toThrow("platform");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
