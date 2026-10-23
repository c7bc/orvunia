import {
  errorDetails,
  requiredHealth,
  requiredProblem,
  type BrowserContext,
  type LiveController,
} from "./contracts.js";
import type { Answer } from "./models.js";
import { readAnswer } from "./responses.js";
export function createGenerationMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<
  LiveController,
  "reportError" | "cancel" | "generate"
> {
  return {
    reportError(this: LiveController, error: unknown) {
      if (errorDetails(error).name === "AbortError") return;
      if (errorDetails(error).name === "NotAllowedError") {
        ports.toast("A permissão de áudio ou tela não foi concedida.");
        return;
      }
      if (errorDetails(error).name === "NotFoundError") {
        ports.toast("A fonte de áudio ou tela não foi encontrada.");
        return;
      }
      ports.toast(
        errorDetails(error).message || "Não foi possível concluir a operação.",
      );
    },
    cancel(this: LiveController) {
      this.controller?.abort();
      this.controller = null;
      for (const a of Object.values(this.answers)) {
        if (a?.pending) {
          a.pending = false;
          a.error = "Resposta cancelada.";
        }
      }
    },
    async generate(this: LiveController, kind: string) {
      if (browser.busy) return;
      const token = ++browser.busyToken;
      browser.busy = true;
      browser.answerKind = kind;
      this.controller = ports.abortController();
      const answer: Answer = {
        text: "",
        model: requiredHealth(this).models.response,
        action: kind,
        pending: true,
      };
      this.answers[browser.mode] = answer;
      const targetMode = browser.mode;
      ports.renderAnswer();
      try {
        const id = await this.ensureSession();
        const p = requiredProblem(ports, browser.currentProblem);
        const result = readAnswer(
          await ports.api.answer(
            id,
            {
              requestId: ports.randomUUID(),
              mode: targetMode,
              action: kind,
              question: kind === "custom" ? browser.customQuestion : "",
              problem:
                targetMode === "technical" &&
                kind !== "custom" &&
                this.practiceSelected
                  ? `${p.title}\n${p.desc}\n${p.input}`
                  : "",
              codeLanguage: browser.preferences.code,
            },
            this.controller!.signal,
            (delta) => {
              if (token !== browser.busyToken) return;
              answer.text += delta;
              ports.renderAnswer();
            },
          ),
        );
        if (token !== browser.busyToken) return;
        answer.text = result.text;
        answer.model = result.model;
        answer.pending = false;
      } catch (error) {
        if (token === browser.busyToken) {
          answer.pending = false;
          answer.error =
            errorDetails(error).name === "AbortError"
              ? "Resposta cancelada."
              : errorDetails(error).message;
          this.reportError(error);
        }
      } finally {
        if (token === browser.busyToken) {
          browser.busy = false;
          this.controller = null;
          ports.renderAnswer();
        }
      }
    },
  };
}
