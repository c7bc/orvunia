import { expect, test } from "bun:test";
import { desktopHeaders } from "../../packages/desktop/headers.ts";
test("native authorization is injected only for a trusted window and the exact HTTP or websocket backend origin", () => {
  const headers = desktopHeaders({
    origin: "http://127.0.0.1:8790",
    token: "synthetic-private-token",
    trusted: (id) => id === 7,
  });
  expect(
    headers({
      url: "http://127.0.0.1:8790/api/bootstrap",
      webContentsId: 7,
      requestHeaders: { authorization: "forged", "x-test": "keep" },
    }),
  ).toEqual({
    requestHeaders: {
      Authorization: "Bearer synthetic-private-token",
      "x-test": "keep",
    },
  });
  expect(
    headers({
      url: "ws://127.0.0.1:8790/api/realtime",
      webContentsId: 7,
      requestHeaders: {},
    }).requestHeaders.Authorization,
  ).toBe("Bearer synthetic-private-token");
  for (const url of [
    "http://127.0.0.1:8791/api",
    "http://localhost:8790/api",
    "https://remote.example.test/api",
    "http://127.0.0.1:8790@remote.example.test/api",
  ])
    expect(
      headers({ url, webContentsId: 7, requestHeaders: {} }).requestHeaders,
    ).toEqual({});
  expect(
    headers({
      url: "http://127.0.0.1:8790/api",
      webContentsId: 8,
      requestHeaders: {},
    }).requestHeaders,
  ).toEqual({});
  expect(
    headers({ url: "http://127.0.0.1:8790/api", requestHeaders: {} })
      .requestHeaders,
  ).toEqual({});
});
test("a private bearer cannot be forwarded on redirect while unrelated authorization is preserved", () => {
  const headers = desktopHeaders({
    origin: "http://127.0.0.1:8790",
    token: "synthetic-private-token",
    trusted: () => true,
  });
  expect(
    headers({
      url: "https://remote.example.test/api",
      webContentsId: 7,
      requestHeaders: { Authorization: "Bearer synthetic-private-token" },
    }).requestHeaders,
  ).toEqual({});
  expect(
    headers({
      url: "https://remote.example.test/api",
      webContentsId: 7,
      requestHeaders: { Authorization: "Basic synthetic-other-credential" },
    }).requestHeaders,
  ).toEqual({ Authorization: "Basic synthetic-other-credential" });
  expect(() =>
    desktopHeaders({
      origin: "https://remote.example.test",
      token: "synthetic",
      trusted: () => true,
    }),
  ).toThrow("loopback");
});
