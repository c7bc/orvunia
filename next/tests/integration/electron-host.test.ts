import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { packageClient } from "../../packages/client/package.ts";
const executable = process.env.CADENCE_TEST_ELECTRON;
if (executable && process.platform === "win32")
  for (const runtimePackage of [
    undefined,
    ...(process.env.CADENCE_TEST_RUNTIME_PACKAGE
      ? [process.env.CADENCE_TEST_RUNTIME_PACKAGE]
      : []),
  ])
    test(`${runtimePackage ? "Packaged" : "Development"} hidden Electron uses native encryption, scoped HTTP headers and a supervised Bun child across restart`, async () => {
      const directory = await mkdtemp(join(tmpdir(), "cadence-electron-host-"));
      const root = fileURLToPath(new URL("../../", import.meta.url));
      const reserve = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: () => new Response(),
      });
      const port = reserve.port;
      await reserve.stop();
      let child: Bun.Subprocess<"ignore", "pipe", "pipe"> | null = null;
      try {
        const client = join(directory, "client");
        if (!runtimePackage)
          await packageClient(join(root, ".."), client, {
            vendorDirectory: root,
          });
        const entrypoint = fileURLToPath(
          new URL("../support/electron-host.ts", import.meta.url),
        );
        const build = await Bun.build({
          entrypoints: [entrypoint],
          target: "node",
          format: "esm",
          external: ["electron"],
          outdir: join(directory, "host"),
        });
        expect(build.success).toBe(true);
        await writeFile(
          join(directory, "host/package.json"),
          JSON.stringify({ type: "module" }),
        );
        child = Bun.spawn([executable, build.outputs[0]!.path], {
          cwd: root,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          env: {
            PATH: process.env.PATH,
            SystemRoot: process.env.SystemRoot,
            CADENCE_TEST_BACKEND_ROOT: root,
            CADENCE_TEST_DATA: directory,
            CADENCE_TEST_BUN: process.execPath,
            CADENCE_TEST_RUNTIME_PACKAGE: runtimePackage,
            CADENCE_LOCAL_TOKEN: randomBytes(32).toString("base64url"),
            CADENCE_LOCAL_WORKSPACE: crypto.randomUUID(),
            PORT: String(port),
          },
        });
        const output = new Response(child.stdout).text();
        const diagnostics = new Response(child.stderr).text();
        const timeout = setTimeout(() => child?.kill(), 30000);
        try {
          const exitCode = await child.exited;
          if (exitCode !== 0) throw Error(await diagnostics);
          expect(exitCode).toBe(0);
        } finally {
          clearTimeout(timeout);
        }
        expect(await output).toContain('"event":"electron_backend_passed"');
        expect(await diagnostics).not.toContain(
          "synthetic-electron-safe-storage-key",
        );
      } finally {
        if (child && child.exitCode === null) {
          child.kill();
          await child.exited;
        }
        await rm(directory, { recursive: true, force: true });
      }
    }, 35000);
