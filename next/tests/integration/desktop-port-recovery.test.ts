import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { desktopBackend } from "../../packages/desktop/host.ts";
import { startOnDesktopPort } from "../../packages/desktop/port-recovery.ts";
import { unusedPersonalPort } from "../support/personal-startup.ts";

test("real host and supervisor recover an occupied bind after releasing the failed private session and reuse the migrated profile", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-host-port-"));
  const profile = join(directory, "profile"),
    client = join(directory, "client");
  await mkdir(profile);
  await mkdir(join(client, "assets"), { recursive: true });
  await writeFile(join(client, "assets/client-routes.json"), '["/"]');
  await writeFile(
    join(client, "index.html"),
    "<!doctype html>synthetic client",
  );
  const occupied = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    reusePort: false,
    fetch: () => new Response("original listener"),
  });
  const available = unusedPersonalPort();
  const token = crypto.randomUUID(),
    workspace = crypto.randomUUID();
  const checksum = createHash("sha256")
    .update(await readFile(process.execPath))
    .digest("hex");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  let selected = 0,
    registrations = 0,
    releases = 0;
  let pointer = "";
  let running: ReturnType<typeof desktopBackend> | null = null;
  const abort = new AbortController();
  try {
    const recovered = await startOnDesktopPort({
      signal: abort.signal,
      select: async () => (selected++ === 0 ? occupied.port! : available),
      start: async (port) => {
        if (selected === 2) {
          expect(releases).toBe(1);
          pointer = await readFile(
            join(profile, "backend-active.json"),
            "utf8",
          );
        }
        const origin = `http://127.0.0.1:${port}`;
        const host = desktopBackend({
          session: {
            webRequest: {
              onBeforeSendHeaders(listener) {
                listener ? registrations++ : releases++;
              },
            },
          },
          contents: () => [],
          onState: () => {},
          launch: {
            executable: process.execPath,
            checksum,
            directory: root,
            entrypoint: join(root, "apps/desktop/server.ts"),
            port,
            environment: {
              ...(process.env.SystemRoot
                ? { SystemRoot: process.env.SystemRoot }
                : {}),
              CADENCE_DEPLOYMENT: "local",
              PORT: String(port),
              CADENCE_DESKTOP_PROFILE: profile,
              CADENCE_DESKTOP_MIGRATION: "quiesced",
              CADENCE_PUBLIC_URL: origin,
              CADENCE_CLIENT_DIRECTORY: client,
              CADENCE_SQLITE_PATH: join(profile, "data/cadence-next.sqlite"),
              CADENCE_LOCAL_TOKEN: token,
              CADENCE_LOCAL_WORKSPACE: workspace,
            },
          },
        });
        try {
          await host.start();
          return { host, origin };
        } catch (error) {
          await host.stop();
          throw error;
        }
      },
    });
    running = recovered.host;
    expect(selected).toBe(2);
    expect(registrations).toBe(2);
    expect(await readFile(join(profile, "backend-active.json"), "utf8")).toBe(
      pointer,
    );
    const headers = { authorization: `Bearer ${token}` };
    const health = await fetch(recovered.origin + "/api/health", { headers });
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ keyConfigured: false });
    expect(
      (
        await fetch(recovered.origin + "/api/health", {
          headers: { authorization: "Bearer synthetic-wrong-identity" },
        })
      ).status,
    ).toBe(401);
    expect(
      await (await fetch(`http://127.0.0.1:${occupied.port}/`)).text(),
    ).toBe("original listener");
    await running.stop();
    running = null;
    expect(releases).toBe(2);
  } finally {
    abort.abort();
    await running?.stop();
    await occupied.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
