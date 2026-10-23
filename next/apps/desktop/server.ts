import { loadLocalSettings as loadSettings } from "../../packages/config/local.ts";
import { processVault } from "../../packages/desktop/process-vault.ts";
import { composePersonal as composeApi } from "../api/personal-compose.ts";
import { serveApplication } from "../api/serve.ts";
import { desktopStorage } from "./storage.ts";
import { desktopStartup } from "./startup.ts";
const settings = loadSettings(process.env);
if (
  settings.CADENCE_DEPLOYMENT !== "local" ||
  !process.connected ||
  !process.env.CADENCE_CLIENT_DIRECTORY
)
  throw Error(
    "The desktop entrypoint requires its private parent and local client package",
  );
const vault = processVault(process.env.CADENCE_PARENT_NONCE);
const startup = desktopStartup(process);
let application: Awaited<ReturnType<typeof composeApi>> | null = null;
let binding = false;
try {
  const local = await desktopStorage(
    settings,
    process.env,
    startup.signal,
    vault?.vault,
  );
  startup.signal.throwIfAborted();
  application = await composeApi(local, {
    ...(vault ? { vault: vault.vault } : {}),
    clientDirectory: process.env.CADENCE_CLIENT_DIRECTORY,
  });
  startup.signal.throwIfAborted();
  binding = true;
  serveApplication(application, local, vault, process);
  binding = false;
} catch (error) {
  const portInUse =
    binding &&
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EADDRINUSE";
  try {
    await application?.close();
  } finally {
    vault?.close();
    if (!startup.signal.aborted) {
      if (process.connected && process.send)
        await new Promise<void>((resolve) =>
          process.send!(
            {
              type: "backend_startup_failed",
              recoverable: false,
              ...(portInUse ? { reason: "port_in_use" } : {}),
            },
            () => resolve(),
          ),
        );
      console.error(JSON.stringify({ event: "desktop_startup_failed" }));
      process.exitCode = 1;
    }
    if (process.connected) process.disconnect?.();
  }
} finally {
  startup.release();
}
