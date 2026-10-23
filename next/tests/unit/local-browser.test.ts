import { expect, test } from "bun:test";
import { localBrowserSession } from "../../packages/identity/local-browser.ts";
const origin = "http://127.0.0.1:9915";
const navigation = {
  "sec-fetch-site": "none",
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document",
};
async function issue(
  session: ReturnType<typeof localBrowserSession>,
  headers = navigation,
  method = "GET",
  path = "/",
) {
  const response = await session.wrap(
    async () =>
      new Response("page", { headers: { "content-type": "text/html" } }),
  )(new Request(origin + path, { headers, method }));
  return response?.headers.get("set-cookie") ?? "";
}
test("local browser authority exists only for explicit top-level same-origin navigation and is private to one process", async () => {
  const session = localBrowserSession(origin),
    cookie = await issue(session);
  expect(cookie).toContain("HttpOnly; SameSite=Strict");
  expect(cookie).not.toContain("Domain=");
  const headers = {
    cookie: cookie.split(";")[0]!,
    "sec-fetch-site": "same-origin",
  };
  expect(
    session.authorize(new Request(origin + "/api/bootstrap", { headers })),
  ).toBe(true);
  expect(
    localBrowserSession(origin).authorize(new Request(origin, { headers })),
  ).toBe(false);
  expect(
    session.authorize(
      new Request(origin, {
        headers: { ...headers, cookie: headers.cookie + "; " + headers.cookie },
      }),
    ),
  ).toBe(false);
  expect(
    session.authorize(
      new Request(origin, {
        headers: { ...headers, cookie: headers.cookie + "tampered" },
      }),
    ),
  ).toBe(false);
  session.close();
  expect(session.authorize(new Request(origin, { headers }))).toBe(false);
  expect(await issue(session)).toBe("");
});
test("cross-origin, frame, subresource and metadata-free requests cannot mint or reuse local authority", async () => {
  const session = localBrowserSession(origin),
    cookie = (await issue(session)).split(";")[0]!;
  for (const site of ["cross-site", "same-site", ""]) {
    expect(
      await issue(session, { ...navigation, "sec-fetch-site": site }),
    ).toBe("");
    expect(
      session.authorize(
        new Request(origin, { headers: { cookie, "sec-fetch-site": site } }),
      ),
    ).toBe(false);
  }
  expect(
    await issue(session, { ...navigation, "sec-fetch-dest": "iframe" }),
  ).toBe("");
  expect(
    await issue(session, { ...navigation, "sec-fetch-mode": "cors" }),
  ).toBe("");
  expect(await issue(session, navigation, "HEAD")).toBe("");
  const headers = { cookie, "sec-fetch-site": "same-origin" };
  expect(
    session.authorize(new Request(origin, { method: "POST", headers })),
  ).toBe(false);
  expect(
    session.authorize(
      new Request(origin, { method: "POST", headers: { ...headers, origin } }),
    ),
  ).toBe(true);
  expect(
    session.authorize(
      new Request(origin, {
        method: "POST",
        headers: { ...headers, origin: "http://127.0.0.1:9920" },
      }),
    ),
  ).toBe(false);
  expect(
    session.authorize(new Request("http://127.0.0.1:9920", { headers })),
  ).toBe(false);
  expect(() => localBrowserSession("http://example.test")).toThrow("loopback");
});
test("WebSocket handshakes require the private cookie and exact Origin even when Chromium omits Fetch Metadata", async () => {
  const session = localBrowserSession(origin),
    cookie = (await issue(session)).split(";")[0]!;
  const headers = { cookie, origin, upgrade: "websocket" };
  expect(session.authorize(new Request(origin + "/ws", { headers }))).toBe(
    true,
  );
  expect(
    session.authorize(
      new Request(origin + "/ws", {
        headers: { ...headers, origin: "http://127.0.0.1:9920" },
      }),
    ),
  ).toBe(false);
  expect(
    session.authorize(
      new Request(origin + "/ws", {
        headers: { ...headers, "sec-fetch-site": "cross-site" },
      }),
    ),
  ).toBe(false);
  expect(
    session.authorize(
      new Request(origin + "/ws", {
        headers: { origin, upgrade: "websocket" },
      }),
    ),
  ).toBe(false);
  expect(
    session.authorize(
      new Request(origin + "/ws", {
        headers: { cookie, upgrade: "websocket" },
      }),
    ),
  ).toBe(false);
  expect(
    session.authorize(new Request(origin + "/ws", { method: "POST", headers })),
  ).toBe(false);
});
