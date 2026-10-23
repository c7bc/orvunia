import type { NativeContext } from "./application-types.ts";
import type { NativeControllers } from "./application-controllers.ts";
import { validateNativeInvocation } from "./native-security.ts";
import { openSupportReportDraft } from "./support-report.ts";
export function registerSupportReport(context: NativeContext, controllers: NativeControllers) {
  context.electron.ipcMain.handle("cadence:openSupportReport", (request, input) => {
    validateNativeInvocation(request, context.origin, controllers.contents());
    controllers.interactive();
    return openSupportReportDraft(input, url => context.electron.shell.openExternal(url));
  });
}
