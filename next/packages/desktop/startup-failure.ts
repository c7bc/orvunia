import { BackendPortInUse, BackendProcessError } from "./errors.ts";

export function backendStartupFailure(message: unknown) {
  if (
    !message ||
    typeof message !== "object" ||
    !("type" in message) ||
    message.type !== "backend_startup_failed" ||
    !("recoverable" in message) ||
    message.recoverable !== false
  )
    return null;
  if ("reason" in message && message.reason === "port_in_use")
    return new BackendPortInUse();
  return new BackendProcessError(
    "Backend storage requires migration review",
    false,
  );
}
