import { expect, test } from "bun:test";
import { configureNativePermissions } from "../../packages/desktop/native-permissions.ts";
import {
  validateNativeInvocation,
  requestNativeDocument,
} from "../../packages/desktop/native-security.ts";
import type {
  NativeSecurityContents,
  NativePermissionSession,
} from "../../packages/desktop/security-types.ts";

function contents(origin: string) {
  const frame = { url: origin + "/desktop.html?view=overlay" };
  return {
    mainFrame: frame,
    getURL: () => frame.url,
    isDestroyed: () => false,
  };
}
test("native invocation requires the current main frame of an owned live document, regardless of matching untrusted origins", () => {
  const origin = "http://127.0.0.1:8790",
    owned = contents(origin),
    foreign = contents(origin);
  expect(() =>
    validateNativeInvocation(
      { sender: owned, senderFrame: owned.mainFrame },
      origin,
      [owned],
    ),
  ).not.toThrow();
  for (const value of [
    { sender: foreign, senderFrame: foreign.mainFrame },
    { sender: owned, senderFrame: { ...owned.mainFrame } },
    { sender: owned, senderFrame: null },
  ])
    expect(() => validateNativeInvocation(value, origin, [owned])).toThrow(
      "Origem",
    );
  owned.mainFrame.url = "https://foreign.example/desktop.html";
  expect(() =>
    validateNativeInvocation(
      { sender: owned, senderFrame: owned.mainFrame },
      origin,
      [owned],
    ),
  ).toThrow("Origem");
});

test("native document proxy limits routes and chooses private Node transport only for the local bearer", async () => {
  const origin = "http://127.0.0.1:8790",
    calls: { mode: string; headers: Headers; url: string }[] = [];
  const sender = {
    ...contents(origin),
    session: {
      async fetch(url: string, options: RequestInit) {
        calls.push({
          mode: "session",
          headers: new Headers(options.headers),
          url,
        });
        return new Response();
      },
    },
  };
  let token: string | null = "synthetic-token";
  const ports = {
    contents: sender,
    trusted: () => [sender],
    origin: () => origin,
    token: () => token,
    async fetch(url: string, options: RequestInit) {
      calls.push({ mode: "node", headers: new Headers(options.headers), url });
      return new Response();
    },
  };
  await requestNativeDocument(ports, "/api/import", { method: "POST" });
  expect(calls[0]!.mode).toBe("node");
  expect(calls[0]!.headers.get("Authorization")).toBe("Bearer synthetic-token");
  token = null;
  await requestNativeDocument(ports, "/api/bootstrap?compact=1", {});
  expect(calls[1]!.mode).toBe("session");
  expect(calls[1]!.headers.has("Authorization")).toBe(false);
  expect(() =>
    requestNativeDocument(ports, "https://foreign.example", {}),
  ).toThrow("Rota");
  sender.mainFrame.url = origin + "/other";
  expect(() => requestNativeDocument(ports, "/api/import", {})).toThrow(
    "Origem",
  );
});

test("media permissions deny foreign windows, child frames and a capture whose source, frame or shutdown changes while enumeration is pending", async () => {
  type Source = { id: string };
  let check!: Parameters<
    NativePermissionSession<Source>["setPermissionCheckHandler"]
  >[0];
  let request!: Parameters<
    NativePermissionSession<Source>["setPermissionRequestHandler"]
  >[0];
  let display!: Parameters<
    NativePermissionSession<Source>["setDisplayMediaRequestHandler"]
  >[0];
  const session = {
    setPermissionCheckHandler: (value: typeof check) => {
      check = value;
    },
    setPermissionRequestHandler: (value: typeof request) => {
      request = value;
    },
    setDisplayMediaRequestHandler: (value: typeof display) => {
      display = value;
    },
  };
  const origin = "http://127.0.0.1:8790",
    owned = contents(origin),
    foreign = contents(origin);
  let enabled = true,
    selected = "screen:1",
    resolve!: (value: Source[]) => void;
  configureNativePermissions({
    session,
    enabled: () => enabled,
    origin: () => origin,
    contents: (): readonly NativeSecurityContents[] => [owned],
    selected: () => selected,
    sources: () =>
      new Promise<Source[]>((done) => {
        resolve = done;
      }),
  });
  expect(check(owned, "media", origin, { isMainFrame: true })).toBe(true);
  expect(check(owned, "media", origin + "/", { isMainFrame: true })).toBe(true);
  for (const untrusted of [origin + ".evil.test", "http://user@127.0.0.1:8790/", "http://127.0.0.1:8791/"])
    expect(check(owned, "media", untrusted, { isMainFrame: true })).toBe(false);
  expect(check(foreign, "media", origin)).toBe(false);
  expect(check(owned, "media", origin, { isMainFrame: false })).toBe(false);
  expect(check(owned, "serial", origin)).toBe(false);
  let allowed: boolean | null = null;
  request(foreign, "media", (value) => {
    allowed = value;
  });
  expect(allowed as boolean | null).toBe(false);
  const attempt = async (change: () => void, frame = owned.mainFrame) => {
    let response: unknown;
    const pending = display({ frame, securityOrigin: origin }, (value) => {
      response = value;
    });
    change();
    resolve([{ id: "screen:1" }]);
    await pending;
    return response;
  };
  expect(
    await attempt(() => {
      selected = "screen:2";
    }),
  ).toEqual({});
  selected = "screen:1";
  expect(
    await attempt(() => {
      enabled = false;
    }),
  ).toEqual({});
  enabled = true;
  expect(
    await attempt(() => {
      owned.mainFrame.url = origin + "/foreign";
    }),
  ).toEqual({});
  owned.mainFrame.url = origin + "/desktop.html";
  let denial: unknown;
  await display(
    { frame: foreign.mainFrame, securityOrigin: origin },
    (value) => {
      denial = value;
    },
  );
  expect(denial).toEqual({});
  expect(await attempt(() => {})).toEqual({
    video: { id: "screen:1" },
    audio: "loopback",
  });
});
