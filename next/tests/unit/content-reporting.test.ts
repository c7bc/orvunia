import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { installContentReporting } from "../../../client/reporting/controller.ts";
import { reportAction } from "../../../client/reporting/action.ts";
import { reportMessages } from "../../../client/reporting/messages.ts";

function fixture(locale = "en", open?: (value: { body: string }) => Promise<unknown>) {
  const { document, window } = parseHTML(`<html><body>${reportAction("answer-1", locale)}<div id="dialogs"></div></body></html>`);
  const copies: string[] = [], messages: string[] = [];
  const controller = installContentReporting({ document: document as unknown as Document, locale: () => locale,
    response: id => id === "answer-1" ? "Selected AI response only" : undefined,
    modal(title, content) { document.querySelector("#dialogs")!.innerHTML = `<section role="dialog" aria-label="${title}">${content}</section>`; },
    close: () => document.querySelector("#dialogs")!.replaceChildren(),
    copy: async text => { copies.push(text); }, toast: message => messages.push(message), ...(open ? { open } : {}) });
  const click = (selector: string) => (document.querySelector(selector)! as unknown as HTMLButtonElement).click();
  const field = (key: string) => document.querySelector(`[data-report-${key}]`)! as unknown as HTMLTextAreaElement;
  const enter = (key: string, value: string) => { field(key).value = value; field(key).dispatchEvent(new window.Event("input", { bubbles: true })); };
  return { document, window, controller, copies, messages, click, field, enter };
}

test("opening shows recipient and privacy choices, without selecting answer or transmitting anything", async () => {
  const opened: unknown[] = [];
  const view = fixture("en", async value => { opened.push(value); return { opened: true }; });
  view.click("[data-report-answer]");
  expect(view.document.querySelector("[role=dialog]")?.getAttribute("aria-label")).toBe("Report answer");
  expect(view.document.body.textContent).toContain("support@orvunia.com");
  expect(view.field("context").value).toBe(""); expect(view.field("preview").value).toBe("");
  view.click("[data-report-open]"); await Bun.sleep(0);
  expect(opened).toEqual([]); expect(view.copies).toEqual([]);
  view.enter("reason", "This answer contains unsafe advice");
  expect(view.field("preview").value).not.toContain("Selected AI response");
  view.click("[data-report-cancel]");
  expect(view.document.querySelector("[role=dialog]")).toBeNull();
  expect(opened).toEqual([]);
  view.controller.dispose();
});

test("explicit selection is editable, preview controls exact native draft and copy is separate", async () => {
  const opened: unknown[] = [];
  const view = fixture("pt-BR", async value => { opened.push(value); return { opened: true }; });
  view.click("[data-report-answer]"); view.enter("reason", "Motivo do relato");
  const include = view.document.querySelector("[data-report-include]")! as unknown as HTMLInputElement;
  include.checked = true; include.dispatchEvent(new view.window.Event("change", { bubbles: true }));
  expect(view.field("context").value).toBe("Selected AI response only");
  view.enter("context", "Trecho revisado sem dados privados");
  const body = "Rascunho escolhido pelo usuário"; view.enter("preview", body);
  view.click("[data-report-open]"); await Bun.sleep(0);
  expect(opened).toEqual([{ body }]); expect(view.copies).toEqual([]);
  view.click("[data-report-copy]"); await Bun.sleep(0);
  expect(view.copies).toEqual([`To: support@orvunia.com\nSubject: Orvunia - AI content report\n\n${body}`]);
  view.controller.dispose(); view.click("[data-report-open]"); await Bun.sleep(0);
  expect(opened).toHaveLength(1);
});

test("browser and missing-handler paths offer manual copy without claiming an email was sent", async () => {
  const view = fixture("es"); view.click("[data-report-answer]"); view.enter("reason", "Contenido incorrecto");
  view.click("[data-report-open]"); await Bun.sleep(0);
  expect(view.document.querySelector("[data-report-status]")?.textContent).toBe(reportMessages("es").fallback);
  expect(view.copies).toEqual([]);
  view.click("[data-report-copy]"); await Bun.sleep(0); expect(view.copies).toHaveLength(1);
  expect(view.document.querySelector("[data-report-status]")?.textContent).toBe(reportMessages("es").copied);
  view.controller.dispose();
});
