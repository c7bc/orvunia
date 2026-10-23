import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { backendStartupFailure } from "../../packages/desktop/startup-failure.ts";
import { BackendPortInUse } from "../../packages/desktop/errors.ts";

test("real desktop child reports an occupied bind through its private IPC and exits without readiness", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-desktop-bind-"));
  const occupied = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    reusePort: false,
    fetch: () => new Response("original listener"),
  });
  const port = occupied.port!;
  const client = join(directory, "client");
  await mkdir(join(client, "assets"), { recursive: true });
  await writeFile(join(client, "assets/client-routes.json"), '["/"]');
  await writeFile(
    join(client, "index.html"),
    "<!doctype html>synthetic desktop",
  );
  const messages: unknown[] = [];
  const child = Bun.spawn([process.execPath, "apps/desktop/server.ts"], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      CADENCE_DEPLOYMENT: "local",
      PORT: String(port),
      CADENCE_BIND_HOST: "127.0.0.1",
      CADENCE_LOCAL_TOKEN: crypto.randomUUID(),
      CADENCE_LOCAL_WORKSPACE: crypto.randomUUID(),
      CADENCE_SQLITE_PATH: join(directory, "data", "cadence-next.sqlite"),
      CADENCE_CLIENT_DIRECTORY: client,
      CADENCE_PUBLIC_URL: `http://127.0.0.1:${port}`,
    },
    ipc: (message) => {
      messages.push(message);
    },
  });
  const output = new Response(child.stdout).text();
  const errors = new Response(child.stderr).text();
  const timeout = setTimeout(() => child.kill(), 15000);
  try {
    expect(await child.exited).toBe(1);
    expect(messages).toEqual([
      {
        type: "backend_startup_failed",
        recoverable: false,
        reason: "port_in_use",
      },
    ]);
    expect(backendStartupFailure(messages[0])).toBeInstanceOf(BackendPortInUse);
    expect(await output).not.toContain("api_ready");
    expect(await errors).toContain('"desktop_startup_failed"');
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe(
      "original listener",
    );
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null) {
      child.kill();
      await child.exited;
    }
    await occupied.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}, 20000);
