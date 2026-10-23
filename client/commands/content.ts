import { requireCommandSession } from "./model.js";
import { commandScope } from "./scope.js";
import { commandSession } from "./boundary.js";

import type { CommandContext } from "./ports.js";
import { copyText } from "../clipboard/text.js";
export async function runContentCommands(
  context: CommandContext,
  key: string,
  value: string,
): Promise<boolean> {
  const { state: browser, ports } = context;
  switch (key) {
    case "import":
      await ports.importFiles();
      return true;
    case "prompt-new":
      ports.promptEditor();
      return true;
    case "prompt-edit":
      ports.promptEditor(browser.library.prompts.find((p) => p.id === value));
      return true;
    case "prompt-delete":
      browser.library.prompts = browser.library.prompts.filter(
        (p) => p.id !== value,
      );
      await ports.saveLibrary();
      return true;
    case "listen":
      await ports.listen();
      return true;
    case "pause":
      await ports.pause();
      return true;
    case "end":
      await ports.end();
      return true;
    case "capture":
      await ports.chooseSource();
      return true;
    case "capture-region":
      await ports.chooseSource("capture-region");
      return true;
    case "attach-image":
      {
        const target = browser.current && {
          id: requireCommandSession(browser).id,
          mode: requireCommandSession(browser).mode,
          state: requireCommandSession(browser).state,
        };
        ports.filePicker(
          "image/png,image/jpeg,image/webp",
          async (files) => {
            for (const file of files)
              await ports.saveImage(file, file.name, target);
          },
          true,
        );
      }
      return true;
    case "clipboard": {
      const text = ports.native
        ? await ports.native.clipboard()
        : await ports.window.navigator.clipboard.readText();
      browser.draft = (browser.draft + "\n" + text).trim().slice(0, 6000);
      ports.render();
      return true;
    }
    case "crop-full":
      await ports.saveCrop(true);
      return true;
    case "crop-save":
      await ports.saveCrop(false);
      return true;
    case "copy":
      await copyText(ports,
        requireCommandSession(browser).responses.find((r) => r.id === value)
          ?.text || "",
      );
      ports.toast("Resposta copiada.");
      return true;
    case "cancel":
    case "cancel-answer":
      browser.controller?.abort();
      return true;
    case "auto":
      await ports.setDesktop({
        autoAnswer: !browser.desktop.settings.autoAnswer,
      });
      return true;
    case "clear":
      ports.clearDialog();
      return true;
    case "clear-responses":
    case "clear-transcripts":
    case "clear-captures":
      if (browser.current) {
        if (browser.busy) {
          ports.toast(
            "Aguarde ou interrompa a resposta antes de limpar o contexto.",
          );
          return true;
        }
        const scope = commandScope(context);
        await ports.request(
          `/sessions/${requireCommandSession(browser).id}/context/${key.slice(6)}`,
          "DELETE",
        );
        if (!scope.current()) return true;
        if (key === "clear-responses")
          ports.coding.attempt(requireCommandSession(browser).id, null);
        if (key === "clear-captures")
          for (const item of [
            ...ports.coding.get(requireCommandSession(browser).id).captures,
          ])
            ports.coding.remove(requireCommandSession(browser).id, item.id);
        const updated = commandSession(
          await ports.request(`/sessions/${scope.sessionId}`),
        );
        if (!scope.current()) return true;
        browser.current = updated;
        ports.closeModal();
        ports.broadcast({ type: "changed" });
        ports.render();
      }
      return true;
    case "capture-delete": {
      const scope = commandScope(context);
      await ports.request(
        `/sessions/${requireCommandSession(browser).id}/captures/${value}`,
        "DELETE",
      );
      if (!scope.current()) return true;
      requireCommandSession(browser).captures = requireCommandSession(
        browser,
      ).captures.filter((c) => c.id !== value);
      ports.render();
      return true;
    }
  }
  return false;
}
