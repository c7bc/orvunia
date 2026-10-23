import type { composePersonal } from "./personal-compose.ts";

type Application = Awaited<ReturnType<typeof composePersonal>>;
type ProcessControl = Pick<
  NodeJS.Process,
  "send" | "connected" | "disconnect" | "exitCode"
> & {
  on(event: string, listener: (value: unknown) => void): unknown;
  once(event: string, listener: (value: unknown) => void): unknown;
  removeListener(event: string, listener: (value: unknown) => void): unknown;
};
export function serveApplication(
  application: Application,
  settings: { CADENCE_BIND_HOST: string; PORT: number },
  parentResource: { close(): void } | null,
  parent: ProcessControl,
) {
  application.api.listen({
    hostname: settings.CADENCE_BIND_HOST,
    port: settings.PORT,
    reusePort: false,
  });
  parent.send?.({ type: "api_ready", port: application.api.server?.port });
  let closing: Promise<void> | null = null;
  function close() {
    if (closing) return closing;
    closing = (async () => {
      const server = application.api.server;
      const forced = setTimeout(() => {
        try {
          void server?.stop(true).catch(() => {});
        } catch {}
      }, 10000);
      forced.unref();
      try {
        const outcomes = await Promise.allSettled([
          Promise.resolve().then(() => application.api.stop()),
          Promise.resolve().then(() => application.drain()),
        ]);
        const failures = outcomes.flatMap((outcome) =>
          outcome.status === "rejected" ? [outcome.reason] : [],
        );
        if (failures.length)
          throw new AggregateError(failures, "API drain failed");
      } finally {
        try {
          await application.close();
        } finally {
          clearTimeout(forced);
          parentResource?.close();
          parent.removeListener("SIGTERM", shutdown);
          parent.removeListener("SIGINT", shutdown);
          parent.removeListener("message", message);
          parent.removeListener("disconnect", disconnected);
          if (parent.connected) parent.disconnect?.();
        }
      }
    })();
    return closing;
  }
  function shutdown() {
    void close().catch(() => {
      console.error(JSON.stringify({ event: "api_shutdown_failed" }));
      parent.exitCode = 1;
    });
  }
  function message(value: unknown) {
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "shutdown"
    )
      shutdown();
  }
  function disconnected() {
    parentResource?.close();
    shutdown();
  }
  parent.once("SIGTERM", shutdown);
  parent.once("SIGINT", shutdown);
  parent.on("message", message);
  parent.once("disconnect", disconnected);
  return { close };
}
