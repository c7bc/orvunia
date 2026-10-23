import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { verifyRuntimeFile } from "./runtime-file.ts";
import { validateBackendLaunch } from "./launch-options.ts";
import type { BackendLaunch } from "./launch-options.ts";
import { desktopVaultServer } from "./vault-server.ts";
import { BackendProcessError, BackendShutdownError } from "./errors.ts";
import { backendStartupFailure } from "./startup-failure.ts";
export async function launchBackend(
  options: BackendLaunch,
  signal: AbortSignal,
) {
  let executable: string;
  try {
    validateBackendLaunch(options);
    executable = await verifyRuntimeFile(
      options.executable,
      options.checksum,
      signal,
    );
  } catch {
    throw new BackendProcessError(
      "Bundled backend runtime could not be verified",
      false,
    );
  }
  signal.throwIfAborted();
  const nonce = randomBytes(32).toString("base64url");
  const environment = {
    ...options.environment,
    CADENCE_BIND_HOST: "127.0.0.1",
    ...(options.vault ? { CADENCE_PARENT_NONCE: nonce } : {}),
  };
  if (!options.vault) delete environment.CADENCE_PARENT_NONCE;
  const child = spawn(executable, [resolve(options.entrypoint)], {
    cwd: resolve(options.directory),
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const terminate = () => {
    try {
      child.kill("SIGKILL");
    } catch {}
  };
  let stopping: Promise<void> | null = null;
  const finished = new Promise<{ code: number | null }>((resolve) => {
    child.once("exit", (code) => resolve({ code }));
    child.once("error", () => resolve({ code: null }));
  });
  const bridge = options.vault
    ? desktopVaultServer({
        nonce,
        vault: options.vault,
        send: (message) => {
          if (child.connected)
            child.send(message, (error) => {
              if (error) terminate();
            });
        },
      })
    : null;
  const receive = (message: unknown) => {
    void bridge?.receive(message).catch(() => {
      bridge.close();
      terminate();
    });
  };
  child.on("message", receive);
  const closeBridge = () => {
    child.off("message", receive);
    bridge?.close();
  };
  void finished.then(closeBridge);
  function stop() {
    if (stopping) return stopping;
    stopping = (async () => {
      if (child.connected) {
        try {
          child.send({ type: "shutdown" }, () => {});
        } catch {}
      }
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          finished,
          new Promise<never>((_, reject) => {
            deadline = setTimeout(() => {
              terminate();
              reject(Error("Backend required forced shutdown"));
            }, options.shutdownMs ?? 10000);
          }),
        ]);
      } catch {
        await Promise.race([
          finished,
          new Promise<never>((_, reject) => {
            deadline = setTimeout(
              () => reject(new BackendShutdownError()),
              2500,
            );
          }),
        ]);
      } finally {
        clearTimeout(deadline);
        closeBridge();
      }
    })();
    return stopping;
  }
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let readyListener: ((message: unknown) => void) | null = null;
  const aborted = () => {
    void stop().catch(() => undefined);
  };
  signal.addEventListener("abort", aborted, { once: true });
  try {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        startupTimer = setTimeout(
          () => reject(Error("Backend startup timed out")),
          options.startupMs ?? 15000,
        );
        readyListener = (message) => {
          const failure = backendStartupFailure(message);
          if (failure) reject(failure);
          if (
            message &&
            typeof message === "object" &&
            "type" in message &&
            message.type === "api_ready" &&
            "port" in message &&
            message.port === options.port
          )
            resolve();
        };
        child.on("message", readyListener);
      }),
      finished.then(() => {
        throw Error("Backend exited before becoming ready");
      }),
    ]);
    signal.throwIfAborted();
    return {
      origin: `http://127.0.0.1:${options.port}`,
      pid: child.pid,
      finished,
      stop,
    };
  } catch (error) {
    await stop();
    if (!signal.aborted && error instanceof BackendProcessError) throw error;
    throw Error(
      signal.aborted ? "Backend startup cancelled" : "Backend startup failed",
    );
  } finally {
    clearTimeout(startupTimer);
    if (readyListener) child.off("message", readyListener);
    signal.removeEventListener("abort", aborted);
  }
}
export type RunningBackend = Awaited<ReturnType<typeof launchBackend>>;
