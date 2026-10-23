import { expect, test } from "bun:test";
import { nativeSmokeHealth } from "../../packages/desktop/smoke-health.ts";

test("native health requires a successful contract and sends the private credential only to its origin", async () => {
  let request: Request | null = null;
  const result = await nativeSmokeHealth({
    origin: "http://127.0.0.1:9876",
    token: "synthetic-health-credential",
    signal: new AbortController().signal,
    fetch: async (input, init) => {
      request = new Request(input, init);
      return Response.json({ keyConfigured: false });
    },
  });
  expect(result).toEqual({ keyConfigured: false });
  expect(request!.url).toBe("http://127.0.0.1:9876/api/health");
  expect(request!.headers.get("authorization")).toBe(
    "Bearer synthetic-health-credential",
  );
  expect(request!.redirect).toBe("error");
});

test("native health errors expose status and approved code without response secrets", async () => {
  for (const [status, code] of [
    [401, "unauthorized"],
    [403, "forbidden"],
    [429, "rate_limited"],
    [503, "unavailable"],
    [500, "internal_error"],
  ] as const) {
    await expect(
      nativeSmokeHealth({
        origin: "http://127.0.0.1:9876",
        token: null,
        signal: new AbortController().signal,
        fetch: async () =>
          Response.json(
            { error: { code, message: "sensitive-value" } },
            { status },
          ),
      }),
    ).rejects.toThrow(`Native smoke health HTTP ${status}: ${code}`);
  }
  await expect(
    nativeSmokeHealth({
      origin: "http://127.0.0.1:9876",
      token: null,
      signal: new AbortController().signal,
      fetch: async () =>
        Response.json({ error: { code: "sensitive-value" } }, { status: 401 }),
    }),
  ).rejects.toThrow("Native smoke health HTTP 401: unknown_error");
  await expect(
    nativeSmokeHealth({
      origin: "http://127.0.0.1:9876",
      token: null,
      signal: new AbortController().signal,
      fetch: async () => Response.json({ error: "sensitive-value" }),
    }),
  ).rejects.toThrow("Native smoke health HTTP 200: invalid contract");
});

test("native health timeout stops transport without leaking its error", async () => {
  const execution = nativeSmokeHealth({
    origin: "http://127.0.0.1:9876",
    token: null,
    signal: new AbortController().signal,
    timeout: 5,
    fetch: async (_input, options) =>
      new Promise((_resolve, reject) => {
        options!.signal!.addEventListener(
          "abort",
          () => reject(Error("sensitive-value")),
          { once: true },
        );
      }),
  });
  await expect(execution).rejects.toThrow(
    "Native smoke health request cancelled or timed out",
  );
});
