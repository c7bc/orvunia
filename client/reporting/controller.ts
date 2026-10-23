import { reportMessages } from "./messages.js";
import { reportView } from "./view.js";
import { validReportBody, reportCopy, reportExcerpt } from "./draft.js";
export function installContentReporting(ports: {
  document: Document;
  locale(): string;
  response(id: string): string | undefined;
  modal(title: string, content: string, className?: string): void;
  close(): void;
  copy(text: string): Promise<unknown>;
  open?(value: { body: string }): Promise<unknown>;
  toast(message: string): void;
}) {
  const document = ports.document;
  let selectedAnswer = "", busy = false, disposed = false;
  const field = (name: string) => document.querySelector<HTMLTextAreaElement>(`[data-report-${name}]`);
  const status = (message: string) => {
    const element = document.querySelector("[data-report-status]");
    if (element) element.textContent = message;
  };
  function updatePreview() {
    const reason = field("reason"), content = field("context"), preview = field("preview");
    if (!reason || !content || !preview) return;
    const t = reportMessages(ports.locale());
    preview.value = reason.value.trim()
      ? `${t.reasonHeading}:\n${reason.value}\n\n${t.contentHeading}:\n${content.value}` : "";
    preview.textContent = preview.value;
    status("");
  }
  function input(event: Event) {
    const target = event.target as HTMLElement | null;
    if (target?.matches("[data-report-reason],[data-report-context]")) updatePreview();
  }
  function change(event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (!target?.matches("[data-report-include]")) return;
    const content = field("context");
    if (content) { content.value = target.checked ? reportExcerpt(selectedAnswer) : ""; content.textContent = content.value; }
    updatePreview();
  }
  async function click(event: MouseEvent) {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-report-answer],[data-report-cancel],[data-report-copy],[data-report-open]");
    if (!target || disposed || busy || target.closest("[inert],[disabled]")) return;
    const t = reportMessages(ports.locale());
    if (target.hasAttribute("data-report-answer")) {
      const answer = ports.response(target.dataset.reportAnswer ?? "");
      if (answer === undefined) { ports.toast(t.unavailable); return; }
      selectedAnswer = answer;
      ports.modal(t.title, reportView(ports.locale()), "report-dialog");
      return;
    }
    if (target.hasAttribute("data-report-cancel")) { selectedAnswer = ""; ports.close(); return; }
    const body = field("preview")?.value ?? "";
    if (!field("reason")?.value.trim() || !validReportBody(body)) { status(t.invalid); return; }
    busy = true;
    try {
      if (target.hasAttribute("data-report-copy")) {
        await ports.copy(reportCopy(body)); if (!disposed) status(t.copied);
      } else {
        const result = await ports.open?.({ body });
        if (!disposed) status(result && typeof result === "object" && "opened" in result && result.opened === true ? t.opened : t.fallback);
      }
    } catch { if (!disposed) status(t.fallback); }
    finally { busy = false; }
  }
  const onClick = (event: MouseEvent) => { void click(event).catch(() => status(reportMessages(ports.locale()).fallback)); };
  document.addEventListener("click", onClick);
  document.addEventListener("input", input);
  document.addEventListener("change", change);
  return { dispose() {
    disposed = true; selectedAnswer = "";
    document.removeEventListener("click", onClick);
    document.removeEventListener("input", input);
    document.removeEventListener("change", change);
  } };
}
