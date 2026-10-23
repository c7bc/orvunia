import { expect, test } from "bun:test";
import { privateDesktopSession } from "../../packages/desktop/session.ts";
import type { NativeSession } from "../../packages/desktop/session.ts";
test("Electron session bridge follows both registered contents and current desktop document, then releases its listener", () => {
  type Listener = Parameters<
    NativeSession["webRequest"]["onBeforeSendHeaders"]
  >[0];
  let listener: Listener = null;
  let location = "http://127.0.0.1:9915/desktop.html?view=panel";
  let destroyed = false;
  const token = "synthetic-private-token-for-native-session";
  const release = privateDesktopSession({
    origin: "http://127.0.0.1:9915",
    token,
    session: {
      webRequest: {
        onBeforeSendHeaders(value) {
          listener = value;
        },
      },
    },
    contents: () => [
      { id: 5, getURL: () => location, isDestroyed: () => destroyed },
    ],
  });
  const request = (url = "http://127.0.0.1:9915/api/bootstrap", id = 5) => {
    let headers: Record<string, string> = {};
    listener!(
      {
        url,
        webContentsId: id,
        requestHeaders: {
          Authorization: `Bearer ${token}`,
          "x-test": "preserved",
        },
      },
      (result) => {
        headers = result.requestHeaders;
      },
    );
    return headers;
  };
  expect(request().Authorization).toBe(`Bearer ${token}`);
  for (const url of [
    "https://external.example.test",
    "http://127.0.0.1:9915/index.html",
    "about:blank",
    "invalid",
  ]) {
    location = url;
    expect(request()).toEqual({ "x-test": "preserved" });
  }
  location = "http://127.0.0.1:9915/desktop.html";
  expect(request("ws://127.0.0.1:9915/api/realtime").Authorization).toBe(
    `Bearer ${token}`,
  );
  expect(
    request("https://external.example.test").Authorization,
  ).toBeUndefined();
  expect(request(undefined, 6).Authorization).toBeUndefined();
  destroyed = true;
  expect(request().Authorization).toBeUndefined();
  release();
  release();
  expect(listener).toBeNull();
});
