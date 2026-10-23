import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { installPanelDisclosures } from "../../../client/disclosure/index.ts";
import { installModePromptEditor } from "../../../client/prompt/index.ts";

function fixture(reducedMotion: boolean) {
  const { document, window } = parseHTML(`<html><body>
    <div class="prompt-editor"><textarea id="instructions">INSTRUCTIONS_DRAFT</textarea></div>
    <details class="mode-system-options"><summary>Avançado · System prompt</summary>
      <div class="prompt-editor"><textarea id="system-prompt">SYSTEM_DRAFT</textarea></div>
    </details></body></html>`);
  const details = document.querySelector("details")!;
  Object.defineProperty(details, "open", { configurable: true,
    get: () => details.hasAttribute("open"), set: (value: boolean) => details.toggleAttribute("open", value) });
  const disposeDisclosure = installPanelDisclosures(document, { reducedMotion });
  const body = details.querySelector<HTMLElement>(".flow-disclosure-content")!;
  let finish = () => {}, cancelled = 0;
  const frames: Keyframe[][] = [];
  body.getBoundingClientRect = () => ({ height: 40 } as DOMRect);
  window.getComputedStyle = () => ({ opacity: "1" } as CSSStyleDeclaration);
  body.animate = (input) => {
    frames.push(input as Keyframe[]);
    return { finished: new Promise<void>(resolve => { finish = resolve; }),
      cancel() { cancelled++; } } as unknown as Animation;
  };
  const editor = installModePromptEditor(document, { getKey: field => field.id === "system-prompt" ? "system:mode" : "mode" });
  const click = () => details.querySelector("summary")!.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
  return { document, details, body, frames, editor, click, finish: () => finish(), cancelled: () => cancelled,
    dispose() { editor.dispose(); disposeDisclosure(); } };
}

test("advanced system prompt uses shared animated disclosure and keeps hidden drafts while closed across rerenders", async () => {
  const current = fixture(false);
  try {
    expect(current.details.open).toBe(false);
    expect(current.body.inert).toBe(true);
    expect(current.editor.value("system:mode")).toBe("SYSTEM_DRAFT");
    current.editor.beforeRender();
    const previous = current.document.querySelector<HTMLTextAreaElement>("#system-prompt")!;
    const replacement = current.document.createElement("textarea");
    replacement.id = previous.id; replacement.value = previous.value;
    previous.setSelectionRange = () => {};
    previous.replaceWith(replacement);
    current.editor.afterRender();
    expect(current.document.querySelector("#system-prompt")).toBe(previous);
    expect(current.details.open).toBe(false);
    expect(current.editor.value("mode")).toBe("INSTRUCTIONS_DRAFT");
    current.click();
    expect(current.frames).toHaveLength(1);
    expect(current.details.open).toBe(true);
    expect(current.body.inert).toBe(false);
    current.finish(); await Promise.resolve();
    current.click();
    expect(current.frames).toHaveLength(2);
    expect(current.body.inert).toBe(true);
    current.finish(); await Promise.resolve();
    expect(current.details.open).toBe(false);
    expect(current.editor.value("system:mode")).toBe("SYSTEM_DRAFT");
  } finally { current.dispose(); }
});

test("advanced prompt reduced motion toggles immediately without an animation or exposing hidden inputs", () => {
  const current = fixture(true);
  try {
    current.click(); expect(current.details.open).toBe(true);
    current.click(); expect(current.details.open).toBe(false);
    expect(current.frames).toHaveLength(0);
    expect(current.body.inert).toBe(true);
    expect(current.details.querySelector("summary")?.getAttribute("aria-expanded")).toBe("false");
  } finally { current.dispose(); }
});
