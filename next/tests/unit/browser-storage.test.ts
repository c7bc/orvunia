import { expect, test } from "bun:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { preserveDesktopBrowserStorage } from "../../packages/desktop/browser-storage.ts";
import {
  desktopStorageEntries,
  desktopBrowserOrigin,
} from "../../packages/desktop/browser-storage-plan.ts";
import { readBrowserStorageOrigin } from "../../packages/desktop/browser-storage-pointer.ts";
import type { BrowserStorageEntries } from "../../packages/desktop/browser-storage-types.ts";

async function fixture() {
  const profile = await mkdtemp(join(tmpdir(), "cadence-browser-storage-"));
  const entries = new Map<string, BrowserStorageEntries>();
  let closed = 0,
    writes = 0;
  const storage = {
    async read(origin: string) {
      return entries.get(origin) ?? [];
    },
    async replace(origin: string, value: BrowserStorageEntries) {
      writes++;
      entries.set(origin, value);
    },
    close() {
      closed++;
    },
  };
  const run = (origin: string, signal = new AbortController().signal) =>
    preserveDesktopBrowserStorage({
      profile,
      origin,
      signal,
      open: async () => storage,
    });
  return {
    profile,
    entries,
    storage,
    run,
    counts: () => ({ closed, writes }),
    close: () => rm(profile, { recursive: true, force: true }),
  };
}

test("first browser migration preserves all distinct Cadence data, verifies writes and records only authoritative origin", async () => {
  const own = await fixture();
  try {
    own.entries.set("http://127.0.0.1:8790", [
      ["cadence-agenda", "synthetic agenda"],
      ["other-app-key", "private"],
    ]);
    own.entries.set("http://127.0.0.1:8793", [["cadence-ui-locale", "pt-BR"]]);
    expect(await own.run("http://127.0.0.1:8809")).toEqual({
      entries: 2,
      moved: true,
    });
    expect(own.entries.get("http://127.0.0.1:8809")).toEqual([
      ["cadence-agenda", "synthetic agenda"],
      ["cadence-ui-locale", "pt-BR"],
    ]);
    expect(await readBrowserStorageOrigin(own.profile)).toBe(
      "http://127.0.0.1:8809",
    );
    const metadata = await readFile(
      join(own.profile, "browser-storage-origin.json"),
      "utf8",
    );
    expect(metadata).not.toContain("synthetic agenda");
    expect(metadata).not.toContain("private");
    expect(own.counts()).toEqual({ closed: 1, writes: 1 });
  } finally {
    await own.close();
  }
});

test("ambiguous historical origins fail before any write and preserve original values", async () => {
  const own = await fixture();
  try {
    own.entries.set("http://127.0.0.1:8790", [["cadence-agenda", "first"]]);
    own.entries.set("http://127.0.0.1:8791", [["cadence-agenda", "second"]]);
    await expect(own.run("http://127.0.0.1:8809")).rejects.toThrow(
      "conflicting",
    );
    expect(own.counts()).toEqual({ closed: 1, writes: 0 });
    expect(await readBrowserStorageOrigin(own.profile)).toBeNull();
    expect(own.entries.get("http://127.0.0.1:8790")).toEqual([
      ["cadence-agenda", "first"],
    ]);
  } finally {
    await own.close();
  }
});

test("port changes use only the last confirmed origin, retain later edits and do not resurrect cleared keys", async () => {
  const own = await fixture();
  try {
    own.entries.set("http://127.0.0.1:8790", [
      ["cadence-agenda", "old"],
      ["cadence-ui-locale", "en"],
    ]);
    await own.run("http://127.0.0.1:8791");
    own.entries.set("http://127.0.0.1:8791", [["cadence-agenda", "latest"]]);
    await own.run("http://127.0.0.1:8790");
    expect(own.entries.get("http://127.0.0.1:8790")).toEqual([
      ["cadence-agenda", "latest"],
    ]);
    const writes = own.counts().writes;
    await own.run("http://127.0.0.1:8790");
    expect(own.counts().writes).toBe(writes);
  } finally {
    await own.close();
  }
});

test("failed writes, corruption or cancellation never publish another browser origin", async () => {
  const own = await fixture();
  try {
    await own.run("http://127.0.0.1:8790");
    own.storage.replace = async () => {
      throw Error("synthetic quota error");
    };
    await expect(own.run("http://127.0.0.1:8791")).rejects.toThrow("quota");
    expect(await readBrowserStorageOrigin(own.profile)).toBe(
      "http://127.0.0.1:8790",
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      own.run("http://127.0.0.1:8791", controller.signal),
    ).rejects.toHaveProperty("name", "AbortError");
    await writeFile(
      join(own.profile, "browser-storage-origin.json"),
      '{"format":"unknown"}',
    );
    await expect(own.run("http://127.0.0.1:8791")).rejects.toThrow("metadata");
    expect(own.counts().closed).toBe(2);
  } finally {
    await own.close();
  }
});

test("snapshot boundary preserves scoped agenda and drafts while refusing oversized or duplicate data and foreign origins", () => {
  const owner = "a".repeat(24),
    session = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  expect(
    desktopStorageEntries([
      [`cadence-agenda:${owner}`, "[]"],
      [`cadence-followup:cadence-agenda:${owner}:${session}`, "draft"],
      ["access-token", "secret"],
    ]),
  ).toHaveLength(2);
  expect(() =>
    desktopStorageEntries([
      ["cadence-agenda", "a"],
      ["cadence-agenda", "b"],
    ]),
  ).toThrow("limits");
  expect(() =>
    desktopStorageEntries([["cadence-agenda", "x".repeat(8 * 1024 * 1024)]]),
  ).toThrow("limits");
  for (const origin of [
    "https://127.0.0.1:8790",
    "http://localhost:8790",
    "http://127.0.0.1:8790/",
    "http://127.0.0.1:8810",
    "http://example.org:8790",
  ])
    expect(() => desktopBrowserOrigin(origin)).toThrow("Invalid");
});
