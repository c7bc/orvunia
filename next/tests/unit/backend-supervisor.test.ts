import { expect, test } from "bun:test";
import { backendSupervisor } from "../../packages/desktop/supervisor.ts";
import { BackendProcessError } from "../../packages/desktop/errors.ts";
import type { BackendLaunch } from "../../packages/desktop/launch-options.ts";
const options: BackendLaunch = {
  executable: "/synthetic/bun",
  checksum: "a".repeat(64),
  entrypoint: "/synthetic/api.ts",
  directory: "/synthetic",
  port: 9915,
  environment: {
    CADENCE_DEPLOYMENT: "local",
    CADENCE_PUBLIC_URL: "http://127.0.0.1:9915",
    PORT: "9915",
  },
};
test("concurrent starts share readiness and planned shutdown never restarts the backend", async () => {
  let launched = 0,
    stopped = 0,
    exited: (value: { code: number }) => void;
  const finished = new Promise<{ code: number }>((resolve) => {
    exited = resolve;
  });
  const supervisor = backendSupervisor(
    options,
    () => {},
    async () => {
      launched++;
      return {
        origin: "http://127.0.0.1:9915",
        pid: 123,
        finished,
        stop: async () => {
          stopped++;
          exited!({ code: 0 });
        },
      };
    },
  );
  const ready = supervisor.start();
  expect(supervisor.start()).toBe(ready);
  expect(await ready).toEqual({ origin: "http://127.0.0.1:9915" });
  expect(supervisor.status()).toBe("running");
  const stopping = supervisor.stop();
  expect(supervisor.stop()).toBe(stopping);
  await stopping;
  expect(launched).toBe(1);
  expect(stopped).toBe(1);
  expect(supervisor.status()).toBe("stopped");
});
test("startup failure retries at most twice and integrity failure cannot be retried", async () => {
  let launched = 0;
  const retrying = backendSupervisor(
    options,
    () => {},
    async () => {
      launched++;
      throw Error("Synthetic startup failure");
    },
  );
  await expect(retrying.start()).rejects.toThrow("bounded recovery");
  expect(launched).toBe(3);
  expect(retrying.status()).toBe("failed");
  await retrying.stop();
  launched = 0;
  const corrupt = backendSupervisor(
    options,
    () => {},
    async () => {
      launched++;
      throw new BackendProcessError("Synthetic integrity failure", false);
    },
  );
  await expect(corrupt.start()).rejects.toThrow("runtime repair");
  await expect(corrupt.start()).rejects.toThrow("current state");
  expect(launched).toBe(1);
  await corrupt.stop();
});
test("stopping during startup cancels the launch and does not queue recovery", async () => {
  let launched = 0;
  const supervisor = backendSupervisor(
    options,
    () => {},
    async (_options, signal) => {
      launched++;
      return new Promise<never>((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(Error("Synthetic cancellation")),
          { once: true },
        );
      });
    },
  );
  const starting = supervisor.start().catch((error: unknown) => error);
  await supervisor.stop();
  expect(await starting).toMatchObject({
    message: "Backend startup cancelled",
  });
  expect(launched).toBe(1);
  expect(supervisor.status()).toBe("stopped");
});
