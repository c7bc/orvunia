import type { ApplicationContext } from "./context.js";
import {
  createApplicationExport,
  createBrowserDownload,
} from "../application-export/index.js";
import { createCalendarImport } from "../application-calendar/index.js";
import { applicationSession } from "./decoders.js";
import { applicationSavedNote, applicationAllNotes } from "./io-boundary.js";
export function assembleApplicationExport(
  context: Pick<
    ApplicationContext,
    | "state"
    | "environment"
    | "notes"
    | "request"
    | "native"
    | "presentation"
    | "modal"
    | "dialogs"
    | "storage"
    | "rendering"
  >,
) {
  const { state, environment, presentation } = context;
  const exporter = createApplicationExport({
    state,
    workspace: () => state.workspaceKey,
    clock: () => new Date(environment.clock()),
    notes: context.notes,
    savedNotes: async (id) =>
      applicationSavedNote(await context.request(`/sessions/${id}/notes`)),
    session: async (id) =>
      applicationSession(await context.request(`/sessions/${id}?full=1`)),
    allNotes: async () =>
      applicationAllNotes(await context.request("/session-notes")),
    allSessions: () => context.request("/sessions/export"),
    native: context.native,
    download: createBrowserDownload({
      document: environment.document,
      url: environment.url,
      blob: environment.blob,
      schedule: (callback, delay) =>
        environment.window.setTimeout(callback, delay),
    }),
    date: presentation.date,
    modeName: (value) => presentation.modeName(value || "recruiter"),
    time: presentation.time,
    actionTitle: presentation.actionTitle,
    translate: environment.translate,
    toast: (message) => context.modal.toast(message),
  });
  const importCalendar = createCalendarImport({
    state,
    workspace: () => state.workspaceKey,
    clock: environment.clock,
    identifier: environment.identifier,
    pick: (...args) => context.dialogs.filePicker(...args),
    save: context.storage.saveAgenda,
    render: () => context.rendering.render(),
    toast: (message) => context.modal.toast(message),
  });
  return { exporter, importCalendar };
}
