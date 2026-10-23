import { backendSupervisor } from "./supervisor.ts";
import type { BackendState } from "./supervisor.ts";
import type { BackendLaunch } from "./launch-options.ts";
import { privateDesktopSession } from "./session.ts";
import type { NativeSession, NativeContents } from "./session.ts";
export function desktopBackend(dependencies: {
  launch: BackendLaunch;
  session: NativeSession;
  contents(): readonly NativeContents[];
  onState(state: BackendState): void;
}) {
  const origin = `http://127.0.0.1:${dependencies.launch.port}`;
  const token = dependencies.launch.environment.CADENCE_LOCAL_TOKEN;
  if (!token || token.length < 32)
    throw Error("Desktop requires a private backend credential");
  const supervisor = backendSupervisor(dependencies.launch, (state) => {
    ready = state === "running";
    dependencies.onState(state);
  });
  let release: (() => void) | null = null;
  let stopping: Promise<void> | null = null;
  let starting: ReturnType<typeof supervisor.start> | null = null;
  let ready = false;
  function start() {
    if (stopping) return Promise.reject(Error("Desktop backend is stopping"));
    if (starting) {
      if (supervisor.status() === "failed")
        return Promise.reject(Error("Desktop backend requires recovery"));
      return starting;
    }
    release = privateDesktopSession({
      session: dependencies.session,
      origin,
      token: token!,
      contents: () => (ready ? dependencies.contents() : []),
    });
    starting = supervisor.start().then(
      (value) => {
        ready = !stopping && supervisor.status() === "running";
        return value;
      },
      (error: unknown) => {
        ready = false;
        release?.();
        release = null;
        starting = null;
        throw error;
      },
    );
    return starting;
  }
  return {
    start,
    status: supervisor.status,
    stop() {
      if (stopping) return stopping;
      ready = false;
      stopping = supervisor.stop().finally(() => {
        release?.();
        release = null;
        starting = null;
        stopping = null;
      });
      return stopping;
    },
  };
}
