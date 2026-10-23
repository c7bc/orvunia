import { renderRepository } from "./view.js";
import { repositoryMessage } from "./messages.js";
import type { createRepositoryController } from "./controller.js";

export function installRepositoryInterface(ports: {
  document: Document;
  controller: ReturnType<typeof createRepositoryController>;
  available(): boolean;
  locale(): string;
  modal(title: string, content: string, className: string): void;
  escape(value: unknown): string;
  toast(value: string): void;
  close(): void;
  approved?(): Promise<void>;
  dismissed?(): void | Promise<void>;
}) {
  const { document, controller } = ports;
  const t = (key: Parameters<typeof repositoryMessage>[1]) => repositoryMessage(ports.locale(), key);
  function render() {
    ports.modal(t(controller.isApproved() ? "title" : "consentTitle"), renderRepository(controller.state,
      { locale: ports.locale(), escape: ports.escape }), "repository-dialog");
  }
  function report(operation: Promise<unknown>) {
    void operation.catch(() => ports.toast(t("error")));
  }
  function dismiss() {
    ports.close();
    report(Promise.resolve(ports.dismissed?.()));
  }
  const click = (event: Event) => {
    const target = event.target;
    if (!(target instanceof document.defaultView!.Element)) return;
    const unapproved = !controller.isApproved() && document.querySelector("[data-repository-view]");
    if (unapproved && (target.closest('[data-action="modal-close"]') || target.classList.contains("modal-backdrop"))) {
      event.preventDefault(); event.stopImmediatePropagation(); dismiss(); return;
    }
    const button = target.closest<HTMLElement>("[data-repository-action]");
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const action = button.dataset.repositoryAction;
    if (action === "open") {
      if (!ports.available()) { ports.toast(t("unavailable")); return; }
      render(); return;
    }
    if (action === "dismiss" || action === "continue") {
      if (action === "dismiss") dismiss();
      else ports.close();
      return;
    }
    if (action === "approve") report(controller.approve().then(async () => {
      if (!controller.isApproved()) return;
      if (document.querySelector("[data-repository-view]")) ports.close();
      await ports.approved?.();
    }));
    else if (action === "refresh") report(controller.refresh());
    else if (action === "revoke") report(controller.revoke().then(() => ports.close()));
    else if (action === "cancel") report(controller.cancel().then(render));
  };
  const submit = (event: Event) => {
    const form = event.target;
    if (!(form instanceof document.defaultView!.HTMLFormElement) || !form.dataset.repositoryForm) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (form.dataset.repositoryForm === "select") {
      const text = form.querySelector<HTMLTextAreaElement>("[name=scope]")?.value || "src\nREADME.md\npackage.json";
      report(controller.select(text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)).then(async () => {
        if (!controller.isApproved()) return;
        ports.close(); await ports.approved?.();
      }));
    }
  };
  document.addEventListener("click", click, true);
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || controller.isApproved() || !document.querySelector("[data-repository-view]")) return;
    event.preventDefault(); event.stopImmediatePropagation(); dismiss();
  };
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("submit", submit, true);
  return {
    open: render,
    renderIfOpen() {
      if (document.querySelector("[data-repository-view]")) render();
    },
    dispose() {
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("submit", submit, true);
    },
  };
}
