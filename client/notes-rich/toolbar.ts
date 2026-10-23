import type { RichContext } from "./contracts.js";
import type { richListeners } from "./elements.js";
export function createRichToolbar(
  context: RichContext,
  listeners: ReturnType<typeof richListeners>,
) {
  const { field, elements } = context;
  const actions: [string, string, () => unknown][] = [
    ["bold", "B", () => context.editor?.chain().focus().toggleBold().run()],
    ["italic", "I", () => context.editor?.chain().focus().toggleItalic().run()],
    [
      "heading",
      "H₂",
      () => context.editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    ],
    [
      "bulletList",
      "• ≡",
      () => context.editor?.chain().focus().toggleBulletList().run(),
    ],
    [
      "orderedList",
      "1. ≡",
      () => context.editor?.chain().focus().toggleOrderedList().run(),
    ],
    [
      "blockquote",
      "❞",
      () => context.editor?.chain().focus().toggleBlockquote().run(),
    ],
    [
      "codeBlock",
      "</>",
      () => context.editor?.chain().focus().toggleCodeBlock().run(),
    ],
  ];
  for (const [name, text, action] of actions) {
    const button = field.ownerDocument.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.dataset.notesFormat = name;
    listeners.listen(button, "mousedown", (event) => event.preventDefault());
    listeners.listen(button, "click", action);
    elements.tools.append(button);
  }
  return () => {
    const editor = context.editor;
    if (!editor || context.destroyed) return;
    const { tools, shell } = elements;
    tools.hidden =
      context.source ||
      !context.editable ||
      !editor.isFocused ||
      editor.state.selection.empty;
    if (!tools.hidden) {
      const cursor = editor.view.coordsAtPos(editor.state.selection.from),
        box = shell.getBoundingClientRect();
      tools.style.top = `${cursor.top - box.top - tools.offsetHeight - 6}px`;
      tools.style.left = `${Math.max(0, Math.min(cursor.left - box.left, box.width - tools.offsetWidth))}px`;
    }
    for (const button of tools.querySelectorAll("button"))
      button.setAttribute(
        "aria-pressed",
        String(editor.isActive(button.dataset.notesFormat || "")),
      );
  };
}
