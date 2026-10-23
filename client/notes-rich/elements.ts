import type { RichElements } from "./contracts.js";
export function createRichElements(field: HTMLTextAreaElement): RichElements {
  const document = field.ownerDocument;
  const shell = document.createElement("div");
  shell.className = "notes-rich";
  if (field.dataset.session !== undefined)
    shell.dataset.notesRich = field.dataset.session;
  field.before(shell);
  shell.append(field);
  const surface = document.createElement("div");
  surface.className = "notes-rich-surface";
  surface.dataset.i18nSkip = "";
  const tools = document.createElement("div");
  tools.className = "notes-rich-tools";
  tools.setAttribute("role", "toolbar");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "notes-source-toggle";
  const hint = document.createElement("div");
  hint.className = "notes-source-hint";
  hint.setAttribute("role", "status");
  shell.prepend(surface, tools, toggle, hint);
  return { shell, surface, tools, toggle, hint };
}
export function richListeners() {
  const cleanup: (() => void)[] = [];
  return {
    listen(target: HTMLElement, name: string, listener: EventListener) {
      target.addEventListener(name, listener);
      cleanup.push(() => target.removeEventListener(name, listener));
    },
    close() {
      for (const remove of cleanup.splice(0)) remove();
    },
  };
}
