import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  startPersonal,
  unusedPersonalPort,
} from "../support/personal-startup.ts";

test("personal startup migrates once, persists identity and sessions across two processes, and never logs credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-personal-startup-"));
  const profile = join(root, "profile"),
    client = join(root, "client");
  await mkdir(join(client, "assets"), { recursive: true });
  await writeFile(join(client, "assets/client-routes.json"), '["/"]');
  await writeFile(
    join(client, "index.html"),
    "<html>synthetic personal client</html>",
  );
  const port = unusedPersonalPort(),
    origin = `http://127.0.0.1:${port}`;
  const secret = "synthetic-provider-secret-" + crypto.randomUUID();
  let identity = "",
    sessionId = "",
    cookie = "";
  let running: Awaited<ReturnType<typeof startPersonal>> | null = null;
  try {
    for (const phase of ["first", "restart"]) {
      running = await startPersonal(profile, client, port, secret);
      expect((await fetch(origin + "/health/ready")).status).toBe(200);
      if (cookie)
        expect(
          (
            await fetch(origin + "/api/bootstrap", {
              headers: { cookie, "sec-fetch-site": "same-origin" },
            })
          ).status,
        ).toBe(401);
      const response = await fetch(origin + "/", {
        headers: {
          "sec-fetch-site": "none",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
        },
      });
      expect(response.status).toBe(200);
      cookie = response.headers.get("set-cookie")!.split(";")[0]!;
      expect(cookie).toContain("cadence_local_");
      const headers = {
        cookie,
        origin,
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
      };
      const currentIdentity = await readFile(
        join(profile, "runtime-profile.json"),
        "utf8",
      );
      if (phase === "first") {
        identity = currentIdentity;
        const created = await fetch(origin + "/api/v1/conversations", {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: "Synthetic persisted session",
            mode: "recruiter",
          }),
        });
        expect(created.status).toBe(201);
        sessionId = ((await created.json()) as { id: string }).id;
        expect(sessionId).toBeTruthy();
      } else {
        expect(currentIdentity).toBe(identity);
        const existing = await fetch(
          origin + "/api/v1/conversations/" + sessionId,
          { headers },
        );
        expect(existing.status).toBe(200);
        expect(await existing.json()).toMatchObject({
          id: sessionId,
          title: "Synthetic persisted session",
        });
      }
      const stopped = await running.close();
      running = null;
      expect(stopped.status).toBe(0);
      const logs = stopped.output + stopped.errors;
      expect(logs).toContain('"personal_started"');
      expect(logs).not.toContain(secret);
      expect(logs).not.toContain(JSON.parse(identity).token);
      expect(logs).not.toContain(cookie);
    }
  } finally {
    await running?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 40000);
