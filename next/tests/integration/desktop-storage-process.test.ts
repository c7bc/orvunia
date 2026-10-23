import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { legacyInstallation } from "../support/legacy-installation.ts";
import { fileVault } from "../../packages/providers/vault.ts";
if (process.platform === "win32")
  for (const invalidVault of [false, true])
    test(`a real Node parent and Bun desktop ${invalidVault ? "refuse inaccessible native credentials without retries or activation" : "migrate over private IPC and retain new writes across restart"}`, async () => {
      const directory = await mkdtemp(
        join(tmpdir(), "cadence-desktop-storage-process-"),
      );
      const key = join(directory, "synthetic-parent.key");
      const fixture = await legacyInstallation(
        join(directory, "data"),
        fileVault(key),
      );
      const before = fixture.snapshot();
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
        await mkdir(join(directory, "client/assets"), { recursive: true });
        await writeFile(
          join(directory, "client/assets/client-routes.json"),
          '["/desktop.html"]',
        );
        await writeFile(
          join(directory, "client/desktop.html"),
          "<!doctype html><title>Synthetic migration</title>",
        );
        child = Bun.spawn(
          [
            "node",
            fileURLToPath(
              new URL("../support/node-storage-parent.ts", import.meta.url),
            ),
          ],
          {
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
              CADENCE_TEST_PARENT_KEY: key,
              CADENCE_TEST_OWNER: fixture.original.owner,
              CADENCE_TEST_SESSION: fixture.original.session,
              CADENCE_TEST_UNAVAILABLE_VAULT: invalidVault ? "1" : "0",
              CADENCE_LOCAL_TOKEN: crypto.randomUUID(),
              PORT: String(port),
            },
          },
        );
        const output = new Response(child.stdout).text(),
          errors = new Response(child.stderr).text();
        const timer = setTimeout(() => child?.kill(), 20000);
        try {
          const code = await child.exited;
          if (code !== 0) throw Error(await errors);
          expect(code).toBe(0);
          expect(await output).toContain(
            '"event":"desktop_storage_protocol_passed"',
          );
          expect(await errors).not.toContain(
            "synthetic-preserved-provider-secret",
          );
          expect(fixture.snapshot()).toEqual(before);
        } finally {
          clearTimeout(timer);
        }
      } finally {
        if (child && child.exitCode === null) {
          child.kill();
          await child.exited;
        }
        fixture.close();
        await rm(directory, { recursive: true, force: true });
      }
    }, 25000);
