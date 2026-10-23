import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { backendSupervisor } from "../../packages/desktop/supervisor.ts";
import { fileVault } from "../../packages/providers/vault.ts";
const root = process.env.CADENCE_TEST_BACKEND_ROOT!;
const profile = process.env.CADENCE_TEST_DATA!;
const executable = process.env.CADENCE_TEST_BUN!;
const vault = fileVault(process.env.CADENCE_TEST_PARENT_KEY!);
const invalidVault = process.env.CADENCE_TEST_UNAVAILABLE_VAULT === "1";
const port = Number(process.env.PORT),
  origin = `http://127.0.0.1:${port}`;
const token = process.env.CADENCE_LOCAL_TOKEN!;
const states: string[] = [];
let opened = 0,
  sealed = 0;
const supervisor = backendSupervisor(
  {
    executable,
    checksum: createHash("sha256")
      .update(await readFile(executable))
      .digest("hex"),
    entrypoint: join(root, "apps/desktop/server.ts"),
    directory: root,
    port,
    startupMs: 10000,
    environment: {
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      CADENCE_DEPLOYMENT: "local",
      CADENCE_LOCAL_TOKEN: token,
      CADENCE_LOCAL_WORKSPACE: crypto.randomUUID(),
      CADENCE_DESKTOP_PROFILE: profile,
      CADENCE_DESKTOP_MIGRATION: "quiesced",
      CADENCE_SQLITE_PATH: join(profile, "unused-default.sqlite"),
      CADENCE_CLIENT_DIRECTORY: join(profile, "client"),
      CADENCE_LEGACY_WORKSPACE: process.env.CADENCE_TEST_OWNER!,
      CADENCE_PUBLIC_URL: origin,
      PORT: String(port),
    },
    vault: {
      async open(value) {
        opened++;
        if (invalidVault) throw Error("Synthetic vault unavailable");
        return vault.open(value);
      },
      async seal(value) {
        sealed++;
        return vault.seal(value);
      },
    },
  },
  (state) => states.push(state),
);
async function request(path: string, method = "GET", body?: object) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      origin,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  assert.equal(text.includes("synthetic-preserved-provider-secret"), false);
  assert.equal(
    response.ok,
    true,
    `Migrated ${method} ${path} returned ${response.status}`,
  );
  return JSON.parse(text);
}
try {
  if (invalidVault) {
    await assert.rejects(supervisor.start(), /runtime repair/);
    assert.deepEqual(states, ["starting", "failed"]);
    assert.ok(opened > 0);
    await assert.rejects(access(join(profile, "backend-active.json")));
  } else {
    await supervisor.start();
    const original = await request(
      `/api/sessions/${process.env.CADENCE_TEST_SESSION}`,
    );
    assert.equal(original.id, process.env.CADENCE_TEST_SESSION);
    assert.equal(original.title, "Conversa preservada");
    assert.equal((await request("/api/onboarding")).completed, true);
    const providers = await request("/api/providers");
    assert.equal(providers.response.keyConfigured, true);
    assert.equal(providers.response.model, "synthetic-custom-model");
    const notesPath = `/api/sessions/${process.env.CADENCE_TEST_SESSION}/notes`;
    const notes = await request(notesPath);
    assert.equal(notes.revision, 7);
    await request(notesPath, "PATCH", {
      text: "Post-migration note",
      revision: notes.revision,
    });
    const pointer = await readFile(
      join(profile, "backend-active.json"),
      "utf8",
    );
    await supervisor.stop();
    await supervisor.start();
    assert.equal(
      await readFile(join(profile, "backend-active.json"), "utf8"),
      pointer,
    );
    assert.equal((await request(notesPath)).text, "Post-migration note");
    assert.equal((await request(notesPath)).revision, 8);
    assert.ok(sealed > 0 && opened > 0);
  }
  await supervisor.stop();
  console.log(
    JSON.stringify({
      event: "desktop_storage_protocol_passed",
      invalidVault,
      opened,
      sealed,
    }),
  );
} catch (error) {
  await supervisor.stop().catch(() => {});
  console.error(
    "Synthetic desktop storage verification failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
}
