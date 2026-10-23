import { launchBackend } from "./launch.ts";
import type { RunningBackend } from "./launch.ts";
import type { BackendLaunch } from "./launch-options.ts";
import {
  BackendProcessError,
  BackendShutdownError,
  BackendPortInUse,
} from "./errors.ts";
export type BackendState =
  "stopped" | "starting" | "running" | "restarting" | "stopping" | "failed";
export function backendSupervisor(
  options: BackendLaunch,
  onState: (state: BackendState) => void,
  launch = launchBackend,
) {
  let state: BackendState = "stopped",
    active: RunningBackend | null = null,
    loop: Promise<void> | null = null,
    first: Promise<{ origin: string }> | null = null,
    abort = new AbortController();
  let fatal = false;
  let stopFailure: BackendShutdownError | null = null;
  function notify(next: BackendState) {
    state = next;
    try {
      onState(next);
    } catch {}
  }
  function start() {
    if (fatal || state === "stopping")
      return Promise.reject(Error("Backend cannot start in its current state"));
    if (first && loop) return first;
    abort = new AbortController();
    const signal = abort.signal;
    let resolveReady: (value: { origin: string }) => void,
      rejectReady: (error: Error) => void;
    first = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    loop = (async () => {
      let failures = 0;
      while (!signal.aborted) {
        notify(failures ? "restarting" : "starting");
        try {
          const running = await launch(options, signal);
          active = running;
          if (signal.aborted) {
            await running.stop();
            break;
          }
          notify("running");
          resolveReady!({ origin: running.origin });
          await running.finished;
          if (active === running) active = null;
          if (signal.aborted) break;
        } catch (error) {
          if (error instanceof BackendShutdownError) {
            stopFailure = error;
            fatal = true;
            notify("failed");
            rejectReady!(error);
            return;
          }
          if (signal.aborted) break;
          if (error instanceof BackendProcessError && !error.recoverable) {
            fatal = true;
            notify("failed");
            rejectReady!(
              error instanceof BackendPortInUse
                ? error
                : Error("Backend requires runtime repair"),
            );
            return;
          }
        }
        if (++failures > 2) {
          notify("failed");
          rejectReady!(Error("Backend failed after bounded recovery"));
          return;
        }
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", finish);
            resolve();
          };
          const timer = setTimeout(finish, failures * 250);
          signal.addEventListener("abort", finish, { once: true });
          if (signal.aborted) finish();
        });
      }
      rejectReady!(Error("Backend startup cancelled"));
      notify("stopped");
    })().finally(() => {
      loop = null;
    });
    return first;
  }
  let stopping: Promise<void> | null = null;
  return {
    start,
    status: () => state,
    stop() {
      if (stopping) return stopping;
      stopping = (async () => {
        notify("stopping");
        abort.abort();
        const current = active;
        if (current) await current.stop();
        await loop;
        if (stopFailure) {
          notify("failed");
          throw stopFailure;
        }
        active = null;
        notify("stopped");
      })().finally(() => {
        stopping = null;
      });
      return stopping;
    },
  };
}
