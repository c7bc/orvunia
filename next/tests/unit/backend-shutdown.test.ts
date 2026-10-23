import { expect, test } from "bun:test";
import { backendSupervisor } from "../../packages/desktop/supervisor.ts";
import { BackendShutdownError } from "../../packages/desktop/errors.ts";
import type { BackendLaunch } from "../../packages/desktop/launch-options.ts";
test("an unconfirmed child shutdown during initialization cannot be reported as cancellation or permit another launch", async () => {
  const options: BackendLaunch = {
    executable: "/synthetic/bun",
    checksum: "a".repeat(64),
    entrypoint: "/synthetic/server.ts",
    directory: "/synthetic",
    port: 9915,
    environment: {},
  };
  let launches = 0;
  const states: string[] = [];
  const supervisor = backendSupervisor(
    options,
    (state) => states.push(state),
    async (_options, signal) => {
      launches++;
      return new Promise<never>((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new BackendShutdownError()),
          { once: true },
        );
      });
    },
  );
  const starting = supervisor.start().catch((error: unknown) => error);
  await expect(supervisor.stop()).rejects.toBeInstanceOf(BackendShutdownError);
  expect(await starting).toBeInstanceOf(BackendShutdownError);
  expect(states).not.toContain("stopped");
  expect(supervisor.status()).toBe("failed");
  await expect(supervisor.start()).rejects.toThrow("current state");
  await expect(supervisor.stop()).rejects.toBeInstanceOf(BackendShutdownError);
  expect(launches).toBe(1);
});
