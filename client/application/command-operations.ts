import type { ApplicationContext } from "./context.js";
import type { HistoryKind } from "../history/view.js";
import type { HistoryDirection } from "../history-application/contracts.js";
import { firstCodeBlock, selectedResponseProblem } from "../coding/render.js";
import { renderScheduleForm } from "../panel/schedule.js";
import { readCommandForm } from "../commands/form.js";
function kind(value: string): HistoryKind {
  if (value !== "responses" && value !== "transcripts" && value !== "captures")
    throw Error("Tipo de histórico inválido.");
  return value;
}
function direction(value: string): HistoryDirection {
  if (value !== "older" && value !== "newer" && value !== "latest")
    throw Error("Direção de histórico inválida.");
  return value;
}
export function applicationCommandOperations(context: ApplicationContext) {
  const { environment, presentation } = context;
  return {
    action: (name: string) => context.commands.action(name),
    ask: (...args: Parameters<typeof context.answer.ask>) =>
      context.commands.run(() => context.answer.ask(...args)),
    begin: context.lifecycle.begin,
    activate: context.lifecycle.activate,
    activateMode: context.modes.activate,
    sync: () => context.synchronization.sync(),
    render: () => context.rendering.render(),
    toast: context.modal.toast,
    modal: context.modal.modal,
    closeModal: context.modal.close,
    codingContextEditor: context.coding.views.contextEditor,
    codingCaptureEditor: context.coding.views.captureEditor,
    navigateHistory: context.navigation.navigate,
    moveHistory: (value: string, view: string, step: string) =>
      context.history.moveHistory(kind(value), view, direction(step)),
    searchSessionHistory: context.history.searchSessionHistory,
    setDesktop: context.storage.setDesktop,
    modeName: presentation.modeName,
    editedMode: () => presentation.editedMode() || undefined,
    applyModes: context.modes.apply,
    captureModeDraft: context.modes.captureDraft,
    saveEditedMode: context.modes.save,
    checkUpdates: context.dialogs.checkUpdates,
    followupEditor: context.followup.open,
    searchDialog: context.search.open,
    downloadData: context.exporter.downloadData,
    importCalendar: context.importCalendar,
    sectionsFromTemplate: parseSections,
    editNoteSections: context.modes.editSections,
    noteTemplateDialog: context.dialogs.noteTemplates,
    reviewRecap: context.history.reviewRecap,
    readNoteSections: context.modes.readSections,
    reviewAsk: context.review.ask,
    profileForm: presentation.profileForm,
    importFiles: context.references.importFiles,
    promptEditor: context.dialogs.promptEditor,
    saveLibrary: context.storage.saveLibrary,
    listen: context.audioFeature.listening.toggle,
    pause: context.lifecycle.pause,
    end: context.lifecycle.end,
    chooseSource: context.captures.chooseSource,
    sources: context.captures.sources,
    filePicker: (
      accept: string,
      callback: (files: File[]) => void | Promise<void>,
      multiple: boolean,
    ) =>
      context.dialogs.filePicker(
        accept,
        (files) => Promise.resolve(callback(files)),
        multiple,
      ),
    saveImage: context.uploads.save,
    saveCrop: context.captures.crop.save,
    exportSession: context.exporter.exportSession,
    loadDevices: context.microphone.loadDevices,
    openMicrophoneTest: context.microphone.open,
    saveAgenda: context.storage.saveAgenda,
    clearDialog: context.dialogs.clear,
    firstCodeBlock,
    selectedResponseProblem,
    renderScheduleForm,
    panelState: () => context.rendering.panel(),
    escape: presentation.escape,
    button: presentation.button,
    translate: environment.translate,
    broadcast: (value: unknown) => environment.broadcast.postMessage(value),
    escapeSelector: environment.escapeSelector,
    clock: environment.clock,
    identifier: environment.identifier,
    duration: presentation.duration,
    time: presentation.time,
    values: readCommandForm,
    setLocale: environment.setLocale,
    modeBase: presentation.modeBase,
    startSession: context.sessions.start,
    startAudio: context.audioFeature.listening.start,
    capture: context.captures.capture,
    autosizeQuestion: context.layout.autosize,
    updateOverlaySize: context.layout.updateSize,
    filteredSessions: context.filteredSessions,
    updateSearchResults: context.search.update,
    saveSessionTitle: context.titles.save,
    saveFollowup: async (form: HTMLFormElement) =>
      Boolean(await context.followup.save(form)),
  };
}
import { sectionsFromTemplate as parseSections } from "../application-services/sections.js";
