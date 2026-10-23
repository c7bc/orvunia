export function desktopStartup(parent: NodeJS.Process) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const receive = (value: unknown) => {
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "shutdown"
    )
      abort();
  };
  parent.on("SIGTERM", abort);
  parent.on("SIGINT", abort);
  parent.on("disconnect", abort);
  parent.on("message", receive);
  if (!parent.connected) abort();
  return {
    signal: controller.signal,
    release() {
      parent.off("SIGTERM", abort);
      parent.off("SIGINT", abort);
      parent.off("disconnect", abort);
      parent.off("message", receive);
    },
  };
}
