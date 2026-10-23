import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localBrowserSession } from "../../packages/identity/local-browser.ts";
const executable = process.env.CADENCE_TEST_ELECTRON;
if (executable && process.platform === "win32")
  test("a real hidden Chromium browser uses personal HttpOnly authority for HTTP and WebSocket and refuses another local origin", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "cadence-personal-browser-"),
    );
    let session: ReturnType<typeof localBrowserSession>,
      blocked = 0;
    const metadata: string[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request, server) {
        const path = new URL(request.url).pathname;
        if (path === "/api/private" || path === "/ws") {
          if (!session.authorize(request)) {
            metadata.push(
              `${path}: site=${request.headers.get("sec-fetch-site")}, mode=${request.headers.get("sec-fetch-mode")}, origin=${request.headers.get("origin") === new URL(request.url).origin}`,
            );
            blocked++;
            return new Response(null, { status: 401 });
          }
          if (path === "/ws")
            return server.upgrade(request)
              ? undefined
              : new Response(null, { status: 400 });
          return new Response("authorized");
        }
        return (
          (await session.wrap(
            async () =>
              new Response(
                "<!doctype html><title>Synthetic personal browser</title>",
                {
                  headers: {
                    "content-type": "text/html",
                    "cache-control": "no-store",
                  },
                },
              ),
          )(request)) ?? new Response(null, { status: 404 })
        );
      },
      websocket: {
        open(socket) {
          socket.send("authorized");
          socket.close();
        },
        message(socket) {
          socket.close(1008, "Unexpected message");
        },
      },
    });
    const origin = `http://127.0.0.1:${server.port}`;
    session = localBrowserSession(origin);
    const other = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () =>
        new Response("<!doctype html><title>Synthetic other origin</title>", {
          headers: { "content-type": "text/html" },
        }),
    });
    let child: Bun.Subprocess<"ignore", "pipe", "pipe"> | null = null;
    try {
      const bundle = await Bun.build({
        entrypoints: [join(import.meta.dir, "../support/personal-browser.ts")],
        target: "node",
        format: "esm",
        external: ["electron"],
        outdir: join(directory, "host"),
      });
      expect(bundle.success).toBe(true);
      await writeFile(
        join(directory, "host/package.json"),
        '{"type":"module"}',
      );
      child = Bun.spawn([executable, bundle.outputs[0]!.path], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          CADENCE_TEST_DATA: directory,
          CADENCE_TEST_URL: origin + "/",
          CADENCE_TEST_OTHER_URL: `http://127.0.0.1:${other.port}/`,
        },
      });
      const output = new Response(child.stdout).text(),
        diagnostics = new Response(child.stderr).text();
      const timeout = setTimeout(() => child?.kill(), 15000);
      try {
        const status = await child.exited;
        if (status !== 0)
          throw Error((await diagnostics) + metadata.join("; "));
        expect(status).toBe(0);
      } finally {
        clearTimeout(timeout);
      }
      expect(await output).toContain('"event":"personal_browser_verified"');
      expect(blocked).toBe(2);
    } finally {
      if (child && child.exitCode === null) child.kill();
      if (child) await child.exited;
      session.close();
      await server.stop(true);
      await other.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  }, 25000);
