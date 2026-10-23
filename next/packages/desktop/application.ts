import { join } from "node:path";
import { writeFileSync } from "node:fs";
import type { NativeOptions } from "./application-types.ts";
import type { NativeControllers } from "./application-controllers.ts";
import { bootstrapNativeApplication } from "./application-bootstrap.ts";
import { createNativeLayout } from "./application-layout.ts";
import { createNativeWindowFactory } from "./application-window.ts";
import { createNativeViews } from "./application-views.ts";
import { createNativeControllers } from "./application-controllers.ts";
import { createNativeLifecycle } from "./application-lifecycle.ts";
import { registerNativeHandlers } from "./application-handlers.ts";
import { startPersonalNativeBackend } from "./personal-backend.ts";
import { runNativeSmoke } from "./application-smoke.ts";
import { createRendererDrain } from "./renderer-drain.ts";

export function createNativeApplication(options: NativeOptions) {
  const context = bootstrapNativeApplication(options);
  if (!context) return null;
  let controllers: NativeControllers;
  let lifecycle: ReturnType<typeof createNativeLifecycle> | null = null;
  const closing = () => lifecycle?.shutdown.running() ?? false;
  const drain = createRendererDrain();
  const motion = options.createMotion({
    enabled: !context.backgroundSmoke,
    onHidden: () => controllers.changed(),
  });
  const layout = createNativeLayout(context, motion, {
    gaze: () => controllers.gaze,
    changed: () => controllers.changed(),
  });
  const makeWindow = createNativeWindowFactory(context, layout, {
    gaze: () => controllers.gaze,
    drain,
    audioGone: (senderId) => { void controllers.systemAudio.senderGone(senderId).catch(() => {}); },
    changed: () => controllers.changed(),
  });
  const views = createNativeViews(
    context,
    layout,
    makeWindow,
    () => controllers.gaze,
  );
  controllers = createNativeControllers(context, layout, views, closing);
  lifecycle = createNativeLifecycle(context, controllers, motion, drain);
  registerNativeHandlers(context, controllers, layout, motion, drain);
  void options.electron.app
    .whenReady()
    .then(async () => {
      await (options.startBackend ?? startPersonalNativeBackend)(context, controllers, closing);
      views.open();
      layout.apply();
      controllers.register();
      if (context.smoke)
        setTimeout(() => {
          void runNativeSmoke(context, layout, controllers).catch(
            (error: unknown) => {
              writeFileSync(
                join(context.profile, "smoke-error.txt"),
                error instanceof Error
                  ? error.stack || error.message
                  : "Native smoke failed",
              );
              context.backgroundSmoke
                ? context.electron.app.exit(1)
                : context.electron.app.quit();
            },
          );
        }, 2000);
    })
    .catch(lifecycle.failed);
  return { context, controllers, lifecycle };
}
