import { requireCommandSession } from "./model.js";

import type { CommandContext } from "./ports.js";
import { copyText } from "../clipboard/text.js";
export async function runCodingContextCommands(
  context: CommandContext,
  key: string,
  value: string,
): Promise<boolean> {
  const { state: browser, ports } = context;
  switch (key) {
    case "coding-context":
      ports.codingContextEditor();
      return true;
    case "coding-captures":
      ports.codingCaptureEditor();
      return true;
    case "coding-image-up":
    case "coding-image-down":
      ports.coding.move(
        requireCommandSession(browser).id,
        value,
        key === "coding-image-up" ? -1 : 1,
      );
      ports.codingCaptureEditor();
      return true;
    case "coding-image-remove":
      ports.coding.remove(requireCommandSession(browser).id, value);
      ports.codingCaptureEditor();
      ports.render();
      return true;
    case "coding-reuse-capture": {
      const capture = browser.current?.captures.find(
        (item) => item.id === value,
      );
      if (!capture) throw Error("Esta captura não está mais disponível.");
      ports.coding.stageExisting(requireCommandSession(browser).id, capture);
      ports.codingCaptureEditor();
      ports.render();
      return true;
    }
    case "coding-clear":
      ports.coding.save(requireCommandSession(browser).id, {
        problem: "",
        code: "",
        language: browser.prefs.code,
      });
      ports.codingContextEditor();
      return true;
    case "coding-discard-workspace":
      if (browser.busy) {
        ports.toast(
          "Aguarde ou interrompa a resposta antes de limpar o contexto.",
        );
        return true;
      }
      ports.coding.clear(requireCommandSession(browser).id);
      ports.codingContextEditor();
      ports.render();
      return true;
    case "coding-use-code": {
      const response = requireCommandSession(browser).responses.find(
        (r) => r.id === value,
      );
      if (response) {
        ports.coding.save(requireCommandSession(browser).id, {
          ...ports.coding.get(requireCommandSession(browser).id),
          code: ports.firstCodeBlock(response.text).slice(0, 24000),
          language:
            ports.coding.get(requireCommandSession(browser).id).language ||
            browser.prefs.code,
        });
        ports.codingContextEditor();
      }
      return true;
    }
    case "coding-copy-partial":
      await copyText(ports,
        ports.attempt(requireCommandSession(browser).id)?.text || "",
      );
      ports.toast("Trecho parcial copiado.");
      return true;
    case "coding-dismiss":
      ports.coding.attempt(requireCommandSession(browser).id, null);
      ports.render();
      return true;
  }
  return false;
}
