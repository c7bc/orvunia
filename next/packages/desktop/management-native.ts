import type { NativeContext } from "./application-types.ts";
import type { NativeControllers } from "./application-controllers.ts";
import { nativeDistribution } from "./distribution.ts";
import { validateNativeInvocation } from "./native-security.ts";
import { nativeLocale } from "./application-state.ts";
export function registerWindowsManagement(context: NativeContext, controllers: NativeControllers) {
  context.electron.ipcMain.handle("cadence:openWindowsManagement", async (request, action) => {
    validateNativeInvocation(request, context.origin, controllers.contents());
    controllers.interactive();
    context.abort.signal.throwIfAborted();
    if (nativeDistribution(context.process).channel !== "msix" || (action !== "startup" && action !== "updates"))
      throw Error("Invalid Windows management action");
    const url = action === "startup" ? "ms-settings:startupapps" : "ms-windows-store://downloadsandupdates";
    try { await context.electron.shell.openExternal(url); }
    catch { throw Error(nativeLocale(context, "Não foi possível abrir o gerenciamento do Windows.",
      "Windows management could not be opened.", "No se pudo abrir la administración de Windows.")); }
    return { opened: true };
  });
}
