import type { ApplicationContext } from "./context.js";
import {
  createApplicationConnections,
  createApplicationDialogs,
  createApplicationMicrophone,
  createApplicationModes,
} from "../application-services/index.js";
import { createGazeController } from "../gaze/index.js";
import type { ApplicationEdition } from "../application-services/edition.js";
import { chooseAuxiliaryFiles } from "../auxiliary/files.js";
import { personalEdition } from "../personal/edition.js";
import { createConnectionPanel } from "../connections/controller.js";
import { createCalendarController } from "../calendar/controller.js";
import {
  renderProviderSettings,
  bindProviderSettings,
} from "../providers/index.js";
import { createMicrophoneTest } from "../microphone/index.js";
import {
  createReferenceImporter,
  chooseReferenceFiles,
} from "../documents/index.js";
import { createFollowupController } from "../followups/controller.js";
import { readMode } from "../commands/boundary.js";
import { record, text } from "../legacy-web/validation.js";
type ResourceContext = Pick<
  ApplicationContext,
  | "state"
  | "environment"
  | "native"
  | "request"
  | "presentation"
  | "modal"
  | "rendering"
  | "lifecycle"
  | "synchronization"
  | "startup"
>;
export function createApplicationResources(context: ResourceContext, edition: ApplicationEdition = personalEdition) {
  const { state, environment, request, native } = context,
    { document, window } = environment,
    presentation = context.presentation;
  const render = () => context.rendering.render(),
    toast = (message: string) => context.modal.toast(message),
    modal = (title: string, content: string, className?: string) =>
      context.modal.modal(title, content, className);
  const connections = createApplicationConnections({
    advanced: createConnectionPanel({ request, changed: render, toast,
      ...(native?.openExternal ? { openExternal: native.openExternal } : {}),
      ...(native?.modelImport ? { importModel: native.modelImport } : {}) }),
    ...(edition.settings ? { managed: edition.settings({ request, changed: render, toast, workspace: () => state.workspaceKey }) } : {}),
    state,
    document,
    native,
    factories: {
      gaze: createGazeController,
      welcome: edition.welcome,
      ...(edition.billing ? { billing: edition.billing } : {}),
      usageView: edition.usageView,
      calendar: createCalendarController,
    },
    request,
    identifier: environment.identifier,
    sync: () => context.synchronization.sync(),
    initialize: () => context.startup.init(),
    begin: (...args) => context.lifecycle.begin(...args),
    navigate: (url) => window.location.assign(url),
    toast,
    translateUI: environment.translateUI,
    escape: presentation.escape,
    render,
    modal,
    renderProviders: renderProviderSettings,
    bindProviders: bindProviderSettings,
  });
  const modes = createApplicationModes({
    state,
    document,
    storage: window.localStorage,
    request,
    changed: () => environment.broadcast.postMessage({ type: "changed" }),
    render,
  });
  const dialogs = createApplicationDialogs({
    ...(state.view === "overlay" && native?.auxiliary ? {
      chooseFiles: (accept: string, multiple: boolean) => chooseAuxiliaryFiles(native.auxiliary!, accept, multiple),
    } : {}),
    state,
    document,
    request,
    modal,
    button: presentation.button,
    translate: environment.translate,
    modeBase: presentation.modeBase,
    escape: presentation.escape,
    icon: environment.icon,
    toast,
  });
  const microphone = createApplicationMicrophone({
    state,
    document,
    enumerate: () => window.navigator.mediaDevices.enumerateDevices(),
    ...(native?.systemAudio ? { systemAudioDevices: () => native.systemAudio!({ action: "list" }) } : {}),
    observe(refresh) {
      const changed = () => refresh(true);
      const observer = document.defaultView ? new document.defaultView.MutationObserver(() => refresh()) : null;
      const root = document.querySelector("#app");
      if (root) observer?.observe(root, { childList: true, subtree: true });
      window.navigator.mediaDevices?.addEventListener("devicechange", changed);
      return () => {
        observer?.disconnect();
        window.navigator.mediaDevices?.removeEventListener("devicechange", changed);
      };
    },
    create: createMicrophoneTest,
    modal,
    button: presentation.button,
    escape: presentation.escape,
    translate: environment.translate,
    toast,
  });
  const references = createReferenceImporter({
    workspace: () => state.workspaceKey,
    modeId: () => state.modeEditor,
    mode: (id) => state.modes.find((mode) => mode.id === id),
    native,
    choose: (signal) => chooseReferenceFiles(document, signal),
    async extract(file, workspace, signal) {
      const form = new FormData();
      form.append("file", file);
      const value = record(
        await request("/import", "POST", form, signal, {
          "X-Cadence-Workspace": workspace.slice("cadence-agenda:".length),
        }),
      );
      return { ...value, name: text(value.name), text: text(value.text) };
    },
    async save(modeId, documents, workspace, signal) {
      return readMode(
        record(
          await request("/modes/" + modeId, "PATCH", { documents }, signal, {
            "X-Cadence-Workspace": workspace.slice("cadence-agenda:".length),
          }),
        ).mode,
      );
    },
    replace: (value) => {
      state.modes = state.modes.map((mode) =>
        mode.id === value.id ? value : mode,
      );
    },
    changed: () => environment.broadcast.postMessage({ type: "changed" }),
    render,
    toast,
    identifier: environment.identifier,
    clock: () => new Date(environment.clock()),
  });
  const followup = createFollowupController({
    api: request,
    current: () => state.current,
    workspace: () => state.workspaceKey,
    modal(title, content) {
      modal(title, content);
      const dialog = document.querySelector<HTMLElement>("#dialogs .modal");
      if (!dialog) throw Error("O diálogo não está disponível.");
      return dialog;
    },
    toast,
    identifier: environment.identifier,
  });
  return { connections, modes, dialogs, microphone, references, followup };
}
