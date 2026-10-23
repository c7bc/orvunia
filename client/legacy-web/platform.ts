import type {
  WorkspaceController,
  WorkspaceData,
  WorkspacePorts,
} from "./workspace-types.js";
import type { CompatibilityPlatform } from "./platform-types.js";
function required<Element extends HTMLElement>(
  document: Document,
  selector: string,
): Element {
  const element = document.querySelector<Element>(selector);
  if (!element) throw Error("Elemento não encontrado: " + selector);
  return element;
}
export function createWorkspacePorts(
  platform: CompatibilityPlatform,
  data: WorkspaceData,
  controller: () => WorkspaceController,
): WorkspacePorts {
  const { window, document } = platform;
  const escape = (value: unknown) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
  function write(key: string, value: unknown) {
    try {
      window.localStorage.setItem("cadence." + key, JSON.stringify(value));
    } catch {
      controller().toast("Não foi possível salvar neste navegador.");
    }
  }
  return {
    ...platform,
    media: window.navigator.mediaDevices,
    data,
    problems: data.problems,
    element: (selector) => required(document, selector),
    optional: (selector) => document.querySelector<HTMLElement>(selector),
    field: (selector) => required<HTMLInputElement>(document, selector),
    button: (selector) => required<HTMLButtonElement>(document, selector),
    dialog: () => required<HTMLDialogElement>(document, "#modal"),
    icon: (name) =>
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${data.icons[name] || data.icons.spark}"/></svg>`,
    escape,
    formatTime: (seconds) =>
      `${Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`,
    write,
    storage: { write },
    toast: (message) => controller().toast(message),
    modal: (title, body, footer) => controller().modal(title, body, footer),
    copy: (value) => controller().copy(value),
    problemHTML: () => controller().problemHTML(),
    renderProfile: () => controller().renderProfile(),
    renderMode: () => controller().renderMode(),
    renderSession: () => controller().renderSession(),
    renderInput: () => controller().renderInput(),
    renderAnswer: () => controller().renderAnswer(),
    historyModal: () => controller().historyModal(),
    summaryModal: (report) => controller().summaryModal(report),
    cancelGeneration: () => controller().cancelGeneration(),
  };
}
