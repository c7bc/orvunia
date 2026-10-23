import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import type { NativeContext, NativeWindowMotion } from "./application-types.ts";
import type { NativeControllers } from "./application-controllers.ts";
import type { createRendererDrain } from "./renderer-drain.ts";
import { createNativeShutdown } from "./shutdown.ts";
import { BackendShutdownError } from "./errors.ts";
import { nativeLocale } from "./application-state.ts";
export function createNativeLifecycle(
  context: NativeContext,
  controllers: NativeControllers,
  motion: NativeWindowMotion,
  drain: ReturnType<typeof createRendererDrain>,
) {
  const { app, dialog, session } = context.electron;
  const shutdown = createNativeShutdown({
    async drain() {
      context.electron.globalShortcut.unregisterAll();
      context.registeredShortcutCount = 0;
      controllers.reminders.stop();
      try { await drain.drain(controllers.contents()); }
      finally { await controllers.systemAudio.stop(); }
      session.defaultSession.flushStorageData();
      if (context.panel) context.panel.webContents.session.flushStorageData();
    },
    async stop() {
      context.abort.abort();
      const cancelled = Promise.resolve(controllers.extension?.stop()).catch(
        () => {},
      );
      const stopped = context.starting
        ? context.starting.then(
            (value) => value.host.stop(),
            (error: unknown) => {
              if (error instanceof BackendShutdownError) throw error;
            },
          )
        : context.runtime
          ? context.runtime.host.stop()
          : context.backend?.app.close();
      await Promise.all([cancelled, stopped]);
    },
    quit() {
      const output = context.process.env.CADENCE_TEST_OUTPUT_DIR;
      if (context.backgroundSmoke && output) {
        mkdirSync(output, { recursive: true });
        writeFileSync(
          join(output, "desktop-shutdown.json"),
          JSON.stringify(drain.snapshot()),
        );
      }
      context.quitting = true;
      app.quit();
    },
    cancel: () => drain.cancel(controllers.contents()),
    failed() {
      controllers.register();
      if (context.backgroundSmoke) {
        writeFileSync(
          join(context.profile, "smoke-error.txt"),
          "Application shutdown could not be confirmed.",
        );
        app.exit(1);
      } else
        dialog.showErrorBox(
          nativeLocale(
            context,
            "Falha ao encerrar",
            "Shutdown failed",
            "Error al cerrar",
          ),
          nativeLocale(
            context,
            "Não foi possível confirmar o salvamento ou o encerramento do serviço. Revise as alterações e tente novamente.",
            "Saving changes or stopping the service could not be confirmed. Review your changes and try again.",
            "No se pudo confirmar el guardado o la detención del servicio. Revisa tus cambios e inténtalo de nuevo.",
          ),
        );
    },
  });
  app.on("before-quit", (request) => {
    if (shutdown.ready()) return;
    request.preventDefault();
    void shutdown.request().catch(() => app.exit(1));
  });
  app.on("will-quit", () => {
    motion.dispose();
    void context.backend?.app.close().catch(() => {});
    context.tray?.destroy();
  });
  app.on("window-all-closed", () => {});
  app.on("second-instance", () => {
    if (!context.backgroundSmoke) motion.show(context.panel);
  });
  function failed(error: unknown) {
    if (context.quitting || shutdown.running()) return;
    if (context.backgroundSmoke) {
      writeFileSync(
        join(context.profile, "smoke-error.txt"),
        error instanceof Error
          ? error.stack || error.message
          : "Native application failed",
      );
      app.exit(1);
      return;
    }
    dialog.showErrorBox(
      nativeLocale(
        context,
        "Orvunia não iniciou",
        "Orvunia could not start",
        "No se pudo iniciar Orvunia",
      ),
      error instanceof Error ? error.message : "Native application failed",
    );
    app.quit();
  }
  return { shutdown, failed };
}
