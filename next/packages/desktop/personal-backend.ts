import type { NativeContext } from "./application-types.ts";
import type { NativeControllers } from "./application-controllers.ts";
import { startCandidateBackend } from "./candidate.ts";
import { nativeSecretVault } from "./native-vault.ts";
import { preserveDesktopBrowserStorage } from "./browser-storage.ts";
import { nativeBrowserStorage } from "./browser-storage-native.ts";
import { configureNativePermissions } from "./native-permissions.ts";
import { nativeEvent } from "./application-state.ts";

export async function startPersonalNativeBackend(context: NativeContext,
  controllers: NativeControllers, closing: () => boolean) {
  const { session, safeStorage, BrowserWindow } = context.electron;
  if (!context.launch || !context.identity)
    throw Error("The personal desktop requires its verified Bun runtime package.");
  if (context.process.env.CADENCE_CLOUD_URL)
    throw Error("The personal desktop cannot use managed deployment configuration.");
  context.starting = startCandidateBackend({
    directory: context.launch.directory, profile: context.profile, identity: context.identity,
    ...(!context.smoke ? { configuration: { root: context.root, environment: context.process.env } } : {}),
    session: session.defaultSession, cookies: session.defaultSession.cookies,
    contents: controllers.contents, vault: nativeSecretVault(safeStorage, context.process.platform),
    signal: context.abort.signal,
    onState: status => nativeEvent(context, "backend", { status }),
  });
  context.runtime = await context.starting;
  context.origin = context.runtime.origin;
  context.vaultProtection = context.runtime.vaultProtection === "os" ? "os" : "file";
  await preserveDesktopBrowserStorage({
    profile: context.profile, origin: context.origin, signal: context.abort.signal,
    open: () => nativeBrowserStorage({
      session: session.defaultSession, signal: context.abort.signal,
      assertQuiescent() {
        if (BrowserWindow.getAllWindows().length)
          throw Error("Browser storage migration requires a quiescent profile");
      },
      createWindow: () => new BrowserWindow({
        show: false, focusable: false, skipTaskbar: true,
        webPreferences: { session: session.defaultSession, sandbox: true,
          contextIsolation: true, nodeIntegration: false },
      }),
    }),
  });
  context.abort.signal.throwIfAborted();
  configureNativePermissions({
    session: session.defaultSession, enabled: () => !context.backgroundSmoke && !closing(),
    origin: () => context.origin, contents: controllers.contents, selected: () => context.sourceId,
    sources: () => context.electron.desktopCapturer.getSources({ types: ["screen", "window"] }),
  });
  return session.defaultSession;
}
