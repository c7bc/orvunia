import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { installModePromptEditor } from "../../../client/prompt/index.ts";

function fixture() {
  const { document, window } = parseHTML(`<html><body>
    <div class="prompt-editor"><textarea id="system-prompt">Act as an interviewer.</textarea><button data-format="bold">System</button></div>
    <div class="prompt-editor"><textarea id="instructions">Prefer SQL.</textarea><button data-format="bold">Instructions</button></div>
  </body></html>`);
  const fields = [...document.querySelectorAll<HTMLTextAreaElement>("textarea")];
  for (const field of fields) {
    field.maxLength = 32768;
    field.selectionStart = 0;
    field.selectionEnd = 3;
    field.scrollTop = 0;
    field.focus = () => {};
    field.setSelectionRange = (start, end) => { field.selectionStart = start ?? 0; field.selectionEnd = end ?? 0; };
    field.setRangeText = (value: string, start: number = 0, end: number = 0) => {
      field.value = field.value.slice(0, start) + value + field.value.slice(end);
    };
  }
  const changes: { text: string; key: string | undefined; field: string }[] = [];
  const controller = installModePromptEditor(document, {
    getKey: field => field.id === "system-prompt" ? "system:mode" : "mode",
    onChange: (text, key, field) => changes.push({ text, key, field: field.id }),
  });
  const click = (id: string) => document.querySelector(`#${id}`)!.closest("div")!
    .querySelector("button")!.dispatchEvent(new window.Event("click", { bubbles: true }));
  const undo = (id: string) => {
    const event = new window.Event("keydown", { bubbles: true, cancelable: true });
    Object.assign(event, { key: "z", ctrlKey: true });
    document.querySelector(`#${id}`)!.dispatchEvent(event);
  };
  return { document, fields, changes, controller, click, undo };
}

test("each mode field owns its formatting toolbar and independent undo history", () => {
  const f = fixture();
  try {
    const [system, instructions] = f.fields;
    f.click("instructions");
    expect(system!.value).toBe("Act as an interviewer.");
    expect(instructions!.value).toBe("**Pre**fer SQL.");
    expect(f.changes.at(-1)?.key).toBe("mode");
    f.click("system-prompt");
    expect(system!.value).toBe("**Act** as an interviewer.");
    expect(f.changes.at(-1)?.key).toBe("system:mode");
    f.undo("instructions");
    expect(instructions!.value).toBe("Prefer SQL.");
    expect(system!.value).toBe("**Act** as an interviewer.");
    f.undo("system-prompt");
    expect(system!.value).toBe("Act as an interviewer.");
  } finally { f.controller.dispose(); }
});

test("rerender preserves both editing surfaces and forgetting a mode removes both field journals", () => {
  const f = fixture();
  try {
    f.click("system-prompt");
    f.click("instructions");
    f.controller.beforeRender();
    for (const field of f.fields) {
      const copy = f.document.createElement("textarea");
      copy.id = field.id;
      copy.value = field.value;
      field.replaceWith(copy);
    }
    f.controller.afterRender();
    for (const field of f.fields) expect(f.document.querySelector(`#${field.id}`)).toBe(field);
    expect(f.controller.value("mode")).toBe(f.fields[1]!.value);
    expect(f.controller.value("system:mode")).toBe(f.fields[0]!.value);
    f.controller.forget("mode");
    expect(f.controller.value("mode")).toBeUndefined();
    expect(f.controller.value("system:mode")).toBeUndefined();
  } finally { f.controller.dispose(); }
});
