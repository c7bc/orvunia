import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const executable = process.env.CADENCE_TEST_ELECTRON;
if (executable && process.platform === "win32")
  test("hidden Electron preserves Chromium agenda and drafts across loopback changes and real application restart without executing original pages", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "cadence-electron-browser-storage-"),
    );
    const root = fileURLToPath(new URL("../../", import.meta.url));
    let child: Bun.Subprocess<"ignore", "pipe", "pipe"> | null = null;
    try {
      const build = await Bun.build({
        entrypoints: [
          fileURLToPath(
            new URL("../support/electron-browser-storage.ts", import.meta.url),
          ),
        ],
        target: "node",
        format: "esm",
        external: ["electron"],
        outdir: join(directory, "host"),
      });
      expect(build.success).toBe(true);
      await writeFile(
        join(directory, "host/package.json"),
        '{"type":"module"}',
      );
      for (const phase of ["prepare", "restart"]) {
        child = Bun.spawn([executable, build.outputs[0]!.path], {
          cwd: root,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          env: {
            PATH: process.env.PATH,
            SystemRoot: process.env.SystemRoot,
            CADENCE_TEST_DATA: directory,
            CADENCE_TEST_PHASE: phase,
          },
        });
        const output = new Response(child.stdout).text(),
          diagnostics = new Response(child.stderr).text();
        const timer = setTimeout(() => child?.kill(), 25000);
        try {
          const status = await child.exited;
          if (status !== 0) throw Error(await diagnostics);
          expect(status).toBe(0);
          expect(await output).toContain(
            '"event":"electron_browser_storage_passed"',
          );
        } finally {
          clearTimeout(timer);
        }
      }
    } finally {
      if (child && child.exitCode === null) {
        child.kill();
        await child.exited;
      }
      await rm(directory, { recursive: true, force: true });
    }
  }, 55000);
