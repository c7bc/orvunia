import type { ApplicationContext } from "./context.js";
import type { CommandEventPorts } from "../commands/event-types.js";
import { readCommandAttempt } from "../commands/attempt.js";
import { applicationCommandOperations } from "./command-operations.js";
export function applicationCommandPorts(
  context: ApplicationContext,
): CommandEventPorts {
  const { state, environment } = context;
  return {
    ...applicationCommandOperations(context),
    workspace: () => state.workspaceKey,
    document: environment.document,
    window: environment.window,
    native: context.native,
    coding: context.coding.coding,
    tellMore: context.coding.tellMore,
    followup: context.followup,
    gaze: context.connections.gaze,
    audio: context.audio,
    preparedReveal: context.coding.prepared,
    sessionNotes: context.notes,
    welcome: context.connections.welcome,
    modePromptEditor: context.prompt,
    modeDrafts: state.modeDrafts,
    notePresets: context.dialogs.presets,
    get accountMarkup() {
      return state.accountMarkup;
    },
    historyPager: context.historyPager,
    detailDrafts: state.detailDrafts,
    get microphoneTest() {
      return state.microphoneTest;
    },
    request: context.request,
    attempt: (sessionId) =>
      readCommandAttempt(context.coding.coding.get(sessionId).attempt),
  };
}
