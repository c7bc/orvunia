import { expect, test } from "bun:test";
import { updateService } from "../../packages/updates/service.ts";
import { updateTarget } from "../../packages/updates/contracts.ts";
const target = updateTarget.parse({
  version: "4.2.0",
  platform: "win32",
  arch: "x64",
});
const release = {
  ...target,
  version: "4.10.0",
  url: "https://downloads.example.test/cadence.zip",
  sha256: "a".repeat(64),
  notes: "Synthetic",
  publishedAt: "2026-10-15T12:00:00Z",
};
const feedUrl = "https://updates.example.test/releases.json";
test("updates stay optional and cache/coalesce bounded platform releases without forwarding credentials", async () => {
  const missing = updateService({
    transport: async () => {
      throw Error("Forbidden network");
    },
    clock: Date.now,
  });
  expect((await missing.check(target)).status).toBe("not-configured");
  let calls = 0,
    now = 100000;
  const checker = updateService({
    feedUrl,
    clock: () => now,
    transport: async (url, options) => {
      calls++;
      expect(url).toBe(feedUrl);
      expect(options?.redirect).toBe("error");
      expect(options?.credentials).toBe("omit");
      expect(options?.headers).toEqual({ Accept: "application/json" });
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      await Promise.resolve();
      return Response.json({
        schema: 1,
        releases: [
          release,
          { ...release, platform: "darwin", version: "999.0.0" },
          { ...release, version: "4.3.0" },
        ],
      });
    },
  });
  const [first, second] = await Promise.all([
    checker.check(target),
    checker.check(target),
  ]);
  expect(calls).toBe(1);
  expect(first).toEqual(second);
  expect(first.status).toBe("available");
  expect("release" in first && first.release?.version).toBe("4.10.0");
  expect((await checker.check({ ...target, version: "4.10.0" })).status).toBe(
    "current",
  );
  expect((await checker.check({ ...target, arch: "arm64" })).status).toBe(
    "current",
  );
  now += 300000;
  await checker.check(target);
  expect(calls).toBe(2);
  await checker.close();
  expect((await checker.check(target)).status).toBe("unavailable");
});
test("malformed, redirected, credential-bearing and oversized update feeds fail without leaking upstream content", async () => {
  for (const response of [
    Response.json({
      schema: 1,
      releases: [{ ...release, url: "http://unsafe.example.test/app" }],
    }),
    Response.json({
      schema: 1,
      releases: [{ ...release, url: "https://user:secret@example.test/app" }],
    }),
    Response.json({
      schema: 1,
      releases: [{ ...release, url: "https://example.test/app#fragment" }],
    }),
    Response.json({ schema: 1, releases: [{ ...release, sha256: "invalid" }] }),
    new Response("x".repeat(131073)),
    new Response("private upstream", { status: 302 }),
  ]) {
    const checker = updateService({
      feedUrl,
      clock: Date.now,
      transport: async () => response,
    });
    expect(await checker.check(target)).toEqual({
      status: "unavailable",
      current: target.version,
    });
    await checker.close();
  }
  let calls = 0;
  for (const unsafe of [
    "http://example.test/feed",
    "https://user:secret@example.test/feed",
    "https://example.test/feed#fragment",
  ]) {
    const checker = updateService({
      feedUrl: unsafe,
      clock: Date.now,
      transport: async () => {
        calls++;
        throw Error("Forbidden network");
      },
    });
    expect((await checker.check(target)).status).toBe("unavailable");
  }
  expect(calls).toBe(0);
});
test("shutdown aborts an in-flight feed and prevents late successful publication", async () => {
  let started!: () => void;
  const active = new Promise<void>((resolve) => {
    started = resolve;
  });
  const checker = updateService({
    feedUrl,
    clock: Date.now,
    transport: async (_, options) => {
      started();
      return new Promise<Response>((_, reject) => {
        options!.signal!.addEventListener(
          "abort",
          () => reject(Error("Synthetic abort")),
          { once: true },
        );
      });
    },
  });
  const pending = checker.check(target);
  await active;
  await checker.close();
  expect((await pending).status).toBe("unavailable");
});
