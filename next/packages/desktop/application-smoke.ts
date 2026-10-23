import { join, extname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { nativeSmokeHealth } from "./smoke-health.ts";
import type { NativeContext } from "./application-types.ts";
import type { NativeLayout } from "./application-layout.ts";
import type { NativeControllers } from "./application-controllers.ts";
import { nativeWindows, requireNativeWindow } from "./application-state.ts";
import { verifyWindowAffinity } from "./smoke-affinity.ts";
import { createNativeDocumentImport } from "./documents.ts";
import { requestNativeDocument } from "./native-security.ts";
import { prepareShutdownFixture } from "./shutdown-fixture.ts";
const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
export async function runNativeSmoke(
  context: NativeContext,
  layout: NativeLayout,
  controllers: NativeControllers,
) {
  const panel = requireNativeWindow(context, "panel"),
    overlay = requireNativeWindow(context, "overlay"),
    control = requireNativeWindow(context, "control");
  const { app, screen, desktopCapturer } = context.electron;
  const directory =
    context.process.env.CADENCE_TEST_OUTPUT_DIR ||
    join(app.isPackaged ? app.getPath("temp") : context.root, "previews");
  mkdirSync(directory, { recursive: true });
  panel.setContentProtection(false);
  await pause(400);
  try {
    writeFileSync(
      join(directory, "desktop-painel.png"),
      (
        await panel.webContents.capturePage(undefined, {
          stayHidden: context.backgroundSmoke,
          stayAwake: true,
        })
      ).toPNG(),
    );
  } catch (error) {
    writeFileSync(join(directory, "capture-error.txt"), String(error));
  }
  layout.show(overlay);
  layout.show(control);
  layout.align();
  await pause(500);
  overlay.setContentProtection(false);
  await pause(400);
  try {
    writeFileSync(
      join(directory, "desktop-overlay.png"),
      (
        await overlay.webContents.capturePage(undefined, {
          stayHidden: context.backgroundSmoke,
          stayAwake: true,
        })
      ).toPNG(),
    );
  } catch {}
  overlay.setContentProtection(true);
  panel.setContentProtection(true);
  const initial = overlay.getBounds();
  layout.position("right");
  const moved = overlay.getBounds();
  layout.position("camera");
  const health = await nativeSmokeHealth({
    origin: context.origin,
    token: context.deployment === "local" ? context.identity?.token ?? null : null,
    signal: context.abort.signal,
    fetch,
  });
  const result: Record<string, unknown> = {
    electron: context.process.versions.electron,
    node: context.process.versions.node,
    keyConfigured: health.keyConfigured,
    contentProtection: overlay.isContentProtected(),
    skipTaskbar: context.settings.protected,
    alwaysOnTop: overlay.isAlwaysOnTop(),
    movement: moved.x !== initial.x,
    bounds: overlay.getBounds(),
    shortcuts: context.failedShortcuts,
    contextIsolation:
      overlay.webContents.getLastWebPreferences().contextIsolation,
    sandbox: overlay.webContents.getLastWebPreferences().sandbox,
    rendering: {
      windowOpacity: overlay.getOpacity(),
      zoomFactor: overlay.webContents.getZoomFactor(),
      displayScale: screen.getDisplayMatching(overlay.getBounds()).scaleFactor,
    },
    runtimeKind:
      context.deployment === "cloud"
        ? "cloud"
        : context.launch?.kind || "legacy",
  };
  overlay.setFocusable(false);
  result.focusAvoidance = !overlay.isFocusable();
  overlay.setFocusable(!context.backgroundSmoke);
  const fixtureDirectory = context.process.env.CADENCE_TEST_FIXTURE_DIR;
  if (fixtureDirectory) {
    const items = await createNativeDocumentImport({
      choose: async () => ({
        canceled: false,
        filePaths: ["pdf", "docx"].map((extension) =>
          join(fixtureDirectory, "reference." + extension),
        ),
      }),
      request: (route, options) =>
        requestNativeDocument(
          {
            contents: panel.webContents,
            trusted: controllers.contents,
            origin: () => context.origin,
            token: () =>
              context.deployment === "local"
                ? context.identity?.token || null
                : null,
            fetch,
          },
          route,
          options,
        ),
      signal: context.abort.signal,
      locale: () => context.settings.uiLocale,
    })();
    result.documents = Object.fromEntries(
      items.map((item) => [
        extname(item.name).slice(1),
        item.text.includes("Cadence validation") ||
          item.text.includes("Cadence migration fixture"),
      ]),
    );
  }
  result.windowsAffinity = verifyWindowAffinity(
    overlay,
    context.desktopDirectory,
    context.process.platform,
  );
  const sources = context.backgroundSmoke
    ? []
    : await desktopCapturer.getSources({
        types: ["window"],
        thumbnailSize: { width: 560, height: 660 },
      });
  result.protectedWindowInSources = context.backgroundSmoke
    ? null
    : sources.some(
        (source) =>
          source.id ===
            `window:${overlay.getMediaSourceId().split(":")[1]}:0` ||
          source.name === "Orvunia — Assistente",
      );
  const background = {
    enabled: context.backgroundSmoke,
    visibleWindows: nativeWindows(context).filter((window) =>
      window.isVisible(),
    ).length,
    focusedWindows: nativeWindows(context).filter((window) =>
      window.isFocused(),
    ).length,
    focusableWindows: nativeWindows(context).filter((window) =>
      window.isFocusable(),
    ).length,
    registeredShortcuts: context.registeredShortcutCount,
    trayCreated: Boolean(context.tray),
    blockedDisplayRequests: context.blockedDisplayRequests,
    ownRendererCaptureOnly: context.backgroundSmoke,
    desktopCaptureSkipped: context.backgroundSmoke,
  };
  result.background = background;
  if (
    context.backgroundSmoke &&
    (background.visibleWindows ||
      background.focusedWindows ||
      background.focusableWindows ||
      background.registeredShortcuts ||
      background.trayCreated)
  )
    throw Error(
      "Background test must never show UI, focus windows, register shortcuts or create a tray.",
    );
  if (
    context.backgroundSmoke &&
    context.launch &&
    context.process.env.CADENCE_TEST_SHUTDOWN_FIXTURE === "1"
  )
    result.shutdownSession = await prepareShutdownFixture(panel.webContents);
  writeFileSync(
    join(directory, "desktop-smoke.json"),
    JSON.stringify(result, null, 2),
  );
  app.quit();
}
