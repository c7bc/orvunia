import { renderPanel as renderShell } from "./shell.js";
import type { PanelState } from "./state.js";
function releaseDismissed() {
  try {
    return (
      typeof localStorage !== "undefined" &&
      Boolean(localStorage.getItem("cadence-v3-news-dismissed"))
    );
  } catch {
    return false;
  }
}
export function renderPanel(state: PanelState) {
  return renderShell({
    ...state,
    releaseDismissed: state.releaseDismissed ?? releaseDismissed(),
  });
}
export { renderHistory } from "./home.js";
export { renderModeCatalog } from "./modes.js";
export { renderHistoryNavigation } from "./paging.js";
export { renderScheduleForm } from "./schedule.js";
export { renderSessionUsage } from "./usage.js";
export { renderSessionTranscript } from "./transcript.js";
export { updateSessionActivity } from "./live.js";
export { renderSessionChat } from "./chat.js";
export {
  installPanelMotion,
  installPanelSelects,
  installPanelDisclosures,
  installSessionActivity,
  installSessionTabs,
  installPanelMenus,
} from "@cadence/components";

export { renderCompatibilitySettings } from "./compatibility-settings.js";
export { renderProfileForm } from "./profile.js";
export { renderAgenda } from "./agenda.js";
export { compatibilitySelect } from "./compatibility-controls.js";
export { runDesktopAction } from "../commands/index.js";
export { installDesktopEvents } from "../commands/events.js";
export { readCommandAttempt } from "../commands/attempt.js";
export { readCommandForm } from "../commands/form.js";
export {
  createApplicationConnections,
  createApplicationModes,
  createApplicationDialogs,
  createApplicationMicrophone,
  saveApplicationAgenda,
  parseApplicationNoteSections,
  serializeApplicationNoteSections,
} from "../application-services/index.js";
export { createApplicationState } from "../application/state.js";
export { createBroadcastHandler } from "../application/broadcast.js";
export { createNativeEventHandler } from "../application/native-events.js";
export { createApplicationSynchronization } from "../application/synchronization.js";
export { createApplicationStartup } from "../application/startup.js";
export { createApplicationAudio } from "../application/audio.js";
export {
  createApplicationExport,
  createBrowserDownload,
} from "../application-export/index.js";
export { createCalendarImport } from "../application-calendar/index.js";
export { createSearchPresentation } from "../application-search/index.js";
export {
  createApplicationRenderer,
  createActivityPresentation,
  createTranscriptPresentation,
  createPanelState,
  createOverlayState,
} from "../application-render/index.js";
