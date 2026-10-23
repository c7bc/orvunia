import { expect, test } from "bun:test";
import { openNativeUpdate } from "../../packages/desktop/application-update.ts";
import type { NativeContext } from "../../packages/desktop/application-types.ts";
import type { PlatformInvocation } from "../../packages/desktop/platform-types.ts";
function fixture() {
  const calls: {
      mode: string;
      url: string;
      headers: Headers;
      signal: AbortSignal | null | undefined;
    }[] = [],
    opened: string[] = [];
  const controller = new AbortController();
  const release = "https://downloads.example.test/Cadence.exe";
  let current = true,
    value: unknown = { status: "available", release: { url: release } };
  const request = async (
    mode: string,
    url: string,
    options: RequestInit = {},
  ) => {
    calls.push({
      mode,
      url,
      headers: new Headers(options.headers),
      signal: options.signal,
    });
    return Response.json(value);
  };
  const context = {
    origin: "http://127.0.0.1:8790",
    deployment: "local",
    identity: { token: "synthetic-private-update-token" },
    abort: controller,
    process: { platform: "win32", arch: "x64" },
    electron: {
      app: { getVersion: () => "4.9.0" },
      shell: {
        async openExternal(url: string) {
          opened.push(url);
        },
      },
    },
  } as unknown as NativeContext;
  const invocation = {
    sender: {
      session: {
        fetch: (url: string, options: RequestInit) =>
          request("session", url, options),
      },
    },
  } as unknown as PlatformInvocation;
  const validate = () => {
    if (!current) throw Error("synthetic sender navigation");
  };
  const fetcher = (url: string, options: RequestInit) => request("node", url, options);
  return {
    context,
    invocation,
    calls,
    opened,
    release,
    controller,
    validate,
    fetcher,
    change: () => {
      current = false;
    },
    result: (next: unknown) => {
      value = next;
    },
  };
}
test("local update validation uses private parent transport with scoped origin/bearer while cloud uses only its approved session", async () => {
  const own = fixture();
  await openNativeUpdate(
    own.context,
    own.invocation,
    own.release,
    () => {},
    own.validate,
    own.fetcher,
  );
  expect(own.calls[0]!.mode).toBe("node");
  expect(own.calls[0]!.headers.get("Authorization")).toBe(
    "Bearer synthetic-private-update-token",
  );
  expect(own.calls[0]!.headers.get("Origin")).toBe(own.context.origin);
  expect(own.opened).toEqual([own.release]);
  own.context.deployment = "cloud";
  own.context.origin = "https://cadence.example.test";
  await openNativeUpdate(
    own.context,
    own.invocation,
    own.release,
    () => {},
    own.validate,
    own.fetcher,
  );
  expect(own.calls[1]!.mode).toBe("session");
  expect(own.calls[1]!.headers.has("Authorization")).toBe(false);
});
test("update opening revalidates the caller, exact advertised release and shutdown cancellation before external effects", async () => {
  const own = fixture();
  own.result({
    status: "available",
    release: { url: "https://foreign.example/other.exe" },
  });
  await expect(
    openNativeUpdate(
      own.context,
      own.invocation,
      own.release,
      () => {},
      own.validate,
      own.fetcher,
    ),
  ).rejects.toThrow("indisponível");
  own.result({ status: "available", release: { url: own.release } });
  const fetcher = async () => {
    own.change();
    return Response.json({
      status: "available",
      release: { url: own.release },
    });
  };
  await expect(
    openNativeUpdate(
      own.context,
      own.invocation,
      own.release,
      () => {},
      own.validate,
      fetcher,
    ),
  ).rejects.toThrow("navigation");
  expect(own.opened).toEqual([]);
  const stopped = fixture();
  stopped.controller.abort();
  await expect(
    openNativeUpdate(
      stopped.context,
      stopped.invocation,
      stopped.release,
      () => {},
      stopped.validate,
      stopped.fetcher,
    ),
  ).rejects.toHaveProperty("name", "AbortError");
  expect(stopped.calls).toEqual([]);
  const unsafe = fixture();
  unsafe.result({
    status: "available",
    release: { url: "http://downloads.example.test/release.exe" },
  });
  await expect(
    openNativeUpdate(
      unsafe.context,
      unsafe.invocation,
      "http://downloads.example.test/release.exe",
      () => {},
      unsafe.validate,
      unsafe.fetcher,
    ),
  ).rejects.toThrow("inválida");
  expect(unsafe.opened).toEqual([]);
});
