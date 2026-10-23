import { expect, test } from "bun:test";
import { startOnDesktopPort } from "../../packages/desktop/port-recovery.ts";
import { backendStartupFailure } from "../../packages/desktop/startup-failure.ts";
import {
  BackendPortInUse,
  BackendProcessError,
  BackendShutdownError,
} from "../../packages/desktop/errors.ts";

test("desktop retries an occupied port only after its failed startup has completed cleanup", async () => {
  const events: string[] = [];
  let port = 8790;
  const result = await startOnDesktopPort({
    signal: new AbortController().signal,
    select: async () => {
      events.push("select");
      return port++;
    },
    start: async (selected) => {
      events.push(`start:${selected}`);
      if (selected === 8790) {
        await Promise.resolve();
        events.push("stopped:8790");
        throw new BackendPortInUse();
      }
      return selected;
    },
  });
  expect(result).toBe(8791);
  expect(events).toEqual([
    "select",
    "start:8790",
    "stopped:8790",
    "select",
    "start:8791",
  ]);
});

test("desktop bounds occupied-port recovery to three attempts and never retries auth, storage or integrity errors", async () => {
  for (const error of [
    new BackendPortInUse(),
    new BackendProcessError("storage", false),
    new BackendProcessError("integrity", false),
    new BackendShutdownError(),
    Error("HTTP 401 unauthorized"),
  ]) {
    let selections = 0;
    await expect(
      startOnDesktopPort({
        signal: new AbortController().signal,
        select: async () => 8790 + selections++,
        start: async () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
    expect(selections).toBe(error instanceof BackendPortInUse ? 3 : 1);
  }
});

test("desktop cancellation prevents a second port selection", async () => {
  const abort = new AbortController();
  let selections = 0;
  await expect(
    startOnDesktopPort({
      signal: abort.signal,
      select: async () => 8790 + selections++,
      start: async () => {
        abort.abort();
        throw new BackendPortInUse();
      },
    }),
  ).rejects.toHaveProperty("name", "AbortError");
  expect(selections).toBe(1);
});

test("only the private startup failure message classifies a bind collision", () => {
  expect(
    backendStartupFailure({
      type: "backend_startup_failed",
      recoverable: false,
      reason: "port_in_use",
    }),
  ).toBeInstanceOf(BackendPortInUse);
  const storage = backendStartupFailure({
    type: "backend_startup_failed",
    recoverable: false,
  });
  expect(storage).toBeInstanceOf(BackendProcessError);
  expect(storage).not.toBeInstanceOf(BackendPortInUse);
  const unknown = backendStartupFailure({
    type: "backend_startup_failed",
    recoverable: false,
    reason: "unknown",
  });
  expect(unknown).toBeInstanceOf(BackendProcessError);
  expect(unknown).not.toBeInstanceOf(BackendPortInUse);
  for (const value of [
    null,
    { code: "EADDRINUSE" },
    { type: "api_ready", reason: "port_in_use" },
    {
      type: "backend_startup_failed",
      recoverable: true,
      reason: "port_in_use",
    },
  ])
    expect(backendStartupFailure(value)).toBeNull();
});
