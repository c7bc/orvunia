import type { ExportPorts } from "./contracts.js";
import { exportSession } from "./markdown.js";
import { downloadData } from "./backup.js";
export { createBrowserDownload } from "./download.js";
export function createApplicationExport(ports: ExportPorts) {
  return {
    exportSession: (sessionId: string) => exportSession(ports, sessionId),
    downloadData: () => downloadData(ports),
  };
}
