import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin } from "@tiptap/pm/state";
import type { RichContext } from "./contracts.js";
import { browserSanitizer } from "./sanitize.js";
export function createNotesEditor(
  context: RichContext,
  updateTools: () => void,
) {
  const { field, elements, options } = context;
  const maximum = field.maxLength > 0 ? field.maxLength : 100000;
  const limit = Extension.create({
    name: "notesLengthLimit",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction(transaction) {
            if (!transaction.docChanged || context.silent) return true;
            const manager = context.editor?.markdown;
            if (!manager)
              throw Error("Notes Markdown extension is unavailable");
            if (manager.serialize(transaction.doc.toJSON()).length <= maximum)
              return true;
            options.onLimit?.();
            return false;
          },
        }),
      ];
    },
  });
  return new Editor({
    element: elements.surface,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: false, defaultProtocol: "https" },
      }),
      Markdown,
      Placeholder.configure({
        placeholder: () => context.strings.placeholder || options.placeholder,
      }),
      limit,
    ],
    content: "",
    contentType: "markdown",
    editable: false,
    editorProps: {
      attributes: {
        "aria-label": options.label,
        role: "textbox",
        "aria-multiline": "true",
        spellcheck: "true",
        "data-notes-visual": "",
      },
      transformPastedHTML:
        options.sanitize || browserSanitizer(field.ownerDocument),
      handleDOMEvents: {
        blur() {
          queueMicrotask(() => {
            if (
              !context.destroyed &&
              !elements.shell.contains(field.ownerDocument.activeElement)
            )
              options.onBlur?.();
          });
          return false;
        },
      },
    },
    onUpdate() {
      if (
        context.destroyed ||
        context.silent ||
        context.source ||
        !context.editor
      )
        return;
      context.value = context.editor.getMarkdown();
      field.value = context.value;
      options.onChange(context.value);
      updateTools();
    },
    onSelectionUpdate: updateTools,
    onFocus: updateTools,
    onBlur: updateTools,
  });
}
