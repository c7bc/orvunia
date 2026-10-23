import type { NativeContext, NativeWindowMotion } from "./application-types.ts";
import type { NativeControllers } from "./application-controllers.ts";
import type { NativeLayout } from "./application-layout.ts";
import type { PlatformInvocation } from "./platform-types.ts";
import type { createRendererDrain } from "./renderer-drain.ts";
import {
  validateNativeInvocation,
  requestNativeDocument,
} from "./native-security.ts";
import { permittedExternalURL } from "./external.ts";
import { nativeEvent, requireNativeWindow } from "./application-state.ts";
import { nativeDocumentDialog } from "./document-dialog.ts";
import { createNativeDocumentImport } from "./documents.ts";
import { importNativeModel } from "./model-import.ts";
import { openNativeUpdate } from "./application-update.ts";
import { nativeRepository } from "./repository-native.ts";
import { writeNativeClipboard } from "./native-clipboard.ts";
import { registerAuxiliarySurface } from "./auxiliary.ts";
import { registerSupportReport } from "./support-native.ts";
import { registerWindowsManagement } from "./management-native.ts";
export function registerNativeHandlers(
  context: NativeContext,
  controllers: NativeControllers,
  layout: NativeLayout,
  motion: NativeWindowMotion,
  drain: ReturnType<typeof createRendererDrain>,
) {
  registerAuxiliarySurface(context);
  registerSupportReport(context, controllers);
  registerWindowsManagement(context, controllers);
  const repository = nativeRepository(context, controllers);
  const validate = (request: PlatformInvocation) =>
    validateNativeInvocation(request, context.origin, controllers.contents());
  const document = (
    request: PlatformInvocation,
    route: string,
    options: RequestInit,
  ) => {
    validate(request);
    return requestNativeDocument(
      {
        contents: request.sender,
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
    );
  };
  const handlers: Record<
    string,
    (request: PlatformInvocation, value: unknown) => unknown
  > = {
    motionComplete: (request, ticket) => ({
      completed: motion.complete(request.sender, ticket),
    }),
    repository: (request, value) => repository.invoke(request, value),
    systemAudio: (request, value) => controllers.systemAudio.invoke(request, value),
    state: (request, value) => {
      drain.ready(request.sender, value);
      return controllers.snapshot();
    },
    flushComplete: (request, value) => drain.complete(request.sender, value),
    async chatVisibility(_request, value) {
      if (typeof value !== "boolean") throw Error("Visibilidade inválida.");
      if (value) layout.show(context.overlay, true);
      else await layout.hide(context.overlay);
      controllers.changed();
      return controllers.snapshot();
    },
    gaze: (request, value) => controllers.gaze.move(request.sender.id, value),
    async openExternal(_request, value) {
      controllers.interactive();
      await context.electron.shell.openExternal(
        permittedExternalURL(value, context.origin, context.remoteURL),
      );
      return { opened: true };
    },
    modelImport: (request, value) => { controllers.interactive(); return importNativeModel(context, request, value, () => validate(request)); },
    openUpdate: (request, value) =>
      openNativeUpdate(context, request, value, controllers.interactive, () =>
        validate(request),
      ),
    settings: (_request, value) => controllers.preferences.update(value),
    shortcutReset: (_request, value) =>
      controllers.preferences.resetShortcut(value),
    panel(_request, page) {
      layout.show(context.panel);
      if (typeof page === "string")
        context.panel?.webContents.send("cadence:event", {
          type: "navigate",
          data: page,
        });
      return controllers.snapshot();
    },
    overlay() {
      layout.show(context.overlay, true);
      layout.show(context.control, true);
      layout.align();
      return controllers.snapshot();
    },
    async begin(_request, value) {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw Error("Sessão inválida.");
      const fields = value as Record<string, unknown>;
      if (
        typeof fields.id !== "string" ||
        (fields.mode !== "recruiter" && fields.mode !== "technical")
      )
        throw Error("Sessão inválida.");
      await controllers.systemAudio.stop();
      context.active = { id: fields.id, mode: fields.mode };
      repository.close();
      layout.show(context.overlay, true);
      layout.show(context.control, true);
      layout.align();
      context.panel?.hide();
      nativeEvent(context, "session", context.active);
      return controllers.snapshot();
    },
    async end() {
      await controllers.systemAudio.stop();
      repository.close();
      controllers.gaze.stop();
      context.active = null;
      if (context.settings.ambientChat) layout.ambient(true);
      else
        await Promise.all([
          layout.hide(context.overlay),
          layout.hide(context.control),
        ]);
      layout.show(context.panel);
      nativeEvent(context, "session", null);
      return controllers.snapshot();
    },
    layout: (_request, value) => layout.resize(value),
    toggle() {
      layout.toggle();
      return controllers.snapshot();
    },
    position(_request, value) {
      layout.position(value);
      return controllers.snapshot();
    },
    sources: () => controllers.capture.list(),
    source: (_request, value) => controllers.capture.select(value),
    capture: (_request, value) => controllers.capture.capture(value),
    clipboard: () => controllers.capture.clipboard(),
    copy: (_request, value) => writeNativeClipboard(context.electron.clipboard, value),
    quit: () => context.electron.app.quit(),
    hide(request) {
      const window = context.electron.BrowserWindow.fromWebContents(
        request.sender,
      );
      return window === context.overlay || window === context.control
        ? layout.hide(window)
        : window?.hide();
    },
    minimize: (request) =>
      context.electron.BrowserWindow.fromWebContents(
        request.sender,
      )?.minimize(),
    maximize(request) {
      const window = context.electron.BrowserWindow.fromWebContents(
        request.sender,
      );
      if (window && window === context.panel)
        window.isMaximized() ? window.unmaximize() : window.maximize();
    },
    export: (_request, value) => controllers.exportFile(value),
    import(request) {
      controllers.interactive();
      return createNativeDocumentImport({
        choose: () =>
          context.electron.dialog.showOpenDialog(
            requireNativeWindow(context, "panel"),
            nativeDocumentDialog(),
          ),
        request: (route, options) => document(request, route, options),
        signal: context.abort.signal,
        locale: () => context.settings.uiLocale,
      })();
    },
    reminders: (_request, value) => controllers.reminders.replace(value),
  };
  for (const [method, handler] of Object.entries(controllers.extension?.handlers ?? {})) {
    if (Object.hasOwn(handlers, method)) throw Error("Native extension overrides a core handler");
    handlers[method] = handler;
  }
  for (const [method, handler] of Object.entries(handlers))
    context.electron.ipcMain.handle(`cadence:${method}`, (request, value) => {
      validate(request);
      return handler(request, value);
    });
}
