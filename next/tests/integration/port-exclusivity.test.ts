import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startPersonal,
  unusedPersonalPort,
} from "../support/personal-startup.ts";

test("production personal entrypoints refuse to share a port across distinct profile identities", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-port-exclusive-"));
  const client = join(directory, "client");
  await mkdir(join(client, "assets"), { recursive: true });
  await writeFile(join(client, "assets/client-routes.json"), '["/"]');
  await writeFile(
    join(client, "index.html"),
    "<!doctype html>synthetic client",
  );
  const port = unusedPersonalPort();
  const origin = `http://127.0.0.1:${port}`;
  let first: Awaited<ReturnType<typeof startPersonal>> | null = null;
  const active: { second: Awaited<ReturnType<typeof startPersonal>> | null } = {
    second: null,
  };
  try {
    first = await startPersonal(join(directory, "first"), client, port, "");
    const document = await fetch(origin + "/", {
      headers: {
        "sec-fetch-site": "none",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      },
    });
    const cookie = document.headers.get("set-cookie")!.split(";")[0]!;
    const second = startPersonal(
      join(directory, "second"),
      client,
      port,
      "",
    ).then((running) => {
      active.second = running;
      return running;
    });
    await expect(second).rejects.toThrow("Personal startup exited: 1");
    for (let request = 0; request < 5; request++) {
      const response = await fetch(origin + "/api/health", {
        headers: { cookie, "sec-fetch-site": "same-origin" },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ keyConfigured: false });
    }
  } finally {
    await active.second?.close();
    await first?.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 40000);
