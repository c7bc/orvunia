import { requireCommandSession } from "./model.js";
import { commandScope } from "./scope.js";
import { commandSession } from "./boundary.js";
import { commandDraft, commandPreset } from "./guards.js";

import type { CommandContext } from "./ports.js";
import { copyText } from "../clipboard/text.js";
export async function runReviewCommands(
  context: CommandContext,
  key: string,
  value: string,
): Promise<boolean> {
  const { state: browser, ports } = context;
  switch (key) {
    case "followup-email":
      if (browser.busy) return true;
      if (
        !requireCommandSession(browser).responses.some(
          (r) => r.action === "email",
        )
      )
        await ports.ask(
          "email",
          ports.translate(
            "Escreva um email de acompanhamento desta reunião, sem inventar informações.",
          ),
          true,
        );
      await ports.followupEditor();
      return true;
    case "followup-copy":
      await ports.followup.copy();
      return true;
    case "followup-send-review":
      await ports.followup.review();
      return true;
    case "followup-send-confirm":
      await ports.followup.confirm();
      return true;
    case "note-add":
      ports.captureModeDraft();
      ports.editNoteSections([
        ...ports.sectionsFromTemplate(
          commandDraft(ports, browser.modeEditor).notes,
        ),
        { title: "", instructions: "" },
      ]);
      return true;
    case "note-remove":
      ports.captureModeDraft();
      ports.editNoteSections(
        ports
          .sectionsFromTemplate(commandDraft(ports, browser.modeEditor).notes)
          .filter((_, i) => i !== Number(value)),
      );
      return true;
    case "note-templates":
      ports.noteTemplateDialog();
      return true;
    case "note-template":
      ports.captureModeDraft();
      ports.editNoteSections(commandPreset(ports, value).sections);
      ports.closeModal();
      ports.toast(
        "Modelo aplicado ao editor. Salve para usar nos próximos resumos.",
      );
      return true;
    case "review-recap":
      await ports.reviewRecap();
      return true;
    case "review-recap-confirm": {
      const token = browser.recapGeneration;
      if (!token || token.id !== browser.current?.id || browser.busy)
        return true;
      browser.recapGeneration = null;
      ports.closeModal();
      await ports.ask(
        "recap",
        "Resuma esta reunião seguindo o modelo de notas do modo.",
        true,
        { applyGenerated: token },
      );
      return true;
    }
    case "copy-generated-summary":
      if (browser.generatedRecapFallback) {
        await copyText(ports,
          browser.generatedRecapFallback.text,
        );
        ports.toast("Resumo copiado.");
      }
      return true;
    case "copy-summary":
      await copyText(ports,
        ports.sessionNotes.value(requireCommandSession(browser).id) ??
          (
            requireCommandSession(browser).latestSummary ||
            requireCommandSession(browser)
              .responses.filter((r) => r.action === "recap")
              .at(-1)
          )?.text ??
          "",
      );
      ports.toast("Resumo copiado.");
      return true;
    case "copy-transcript":
      await copyText(ports,
        commandSession(
          await ports.request(
            `/sessions/${requireCommandSession(browser).id}?full=1`,
          ),
        )
          .transcripts.map((item) => `${item.who} [${item.time}]: ${item.text}`)
          .join("\n\n"),
      );
      ports.toast("Transcrição copiada.");
      return true;
    case "resume-detail": {
      if (
        browser.sessions.some(
          (s) =>
            s.id !== requireCommandSession(browser).id && s.state !== "ended",
        )
      ) {
        ports.toast("Encerre a outra sessão antes de retomar esta.");
        return true;
      }
      const scope = commandScope(context);
      const resumed = commandSession(
        await ports.request(
          `/sessions/${requireCommandSession(browser).id}/resume`,
          "POST",
        ),
      );
      if (!scope.current()) return true;
      browser.current = resumed;
      await ports.activate(resumed.id);
      ports.broadcast({ type: "changed" });
      return true;
    }
    case "save-notes-template":
      await ports.saveEditedMode({ sections: ports.readNoteSections() });
      ports.captureModeDraft();
      ports.broadcast({ type: "changed" });
      ports.toast("Modelo de notas salvo.");
      return true;
    case "rename-session":
      ports.modal(
        "Renomear sessão",
        `<form id="rename-session-form"><label for="rename-title">Nome da sessão</label><input id="rename-title" name="title" required maxlength="200" value="${ports.escape(requireCommandSession(browser).title)}" style="width:100%"><div class="form-footer"><button class="btn primary">Salvar</button></div></form>`,
      );
      return true;
    case "review-ask":
      await ports.reviewAsk();
      return true;
    case "session-chat-close":
      ports.closeModal();
      return true;
    case "session-chat-send":
      await ports.reviewAsk("#session-chat-question");
      return true;
  }
  return false;
}
