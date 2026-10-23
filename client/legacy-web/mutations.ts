import { type BrowserContext, type LiveController } from "./contracts.js";
import type { Profile } from "./models.js";
import {
  readProfileResult,
  readPreferencesResult,
  readTranscription,
} from "./responses.js";
export function createMutationsMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<
  LiveController,
  "saveContext" | "saveSettings" | "saveText" | "transcribeFile"
> {
  return {
    async saveContext(this: LiveController) {
      const fields = {
          name: "ctx-name",
          role: "ctx-role",
          job: "ctx-job",
          company: "ctx-company",
          tags: "ctx-tags",
          experience: "ctx-experience",
          description: "ctx-description",
        },
        next: Profile = {
          name: "",
          role: "",
          job: "",
          company: "",
          tags: "",
          experience: "",
          description: "",
        };
      for (const [key, id] of Object.entries(fields))
        next[key as keyof Profile] = ports.field("#" + id).value.trim();
      try {
        const result = readProfileResult(
          await ports.api.request("/profile", { method: "PUT", body: next }),
        );
        browser.profile = result.profile;
        ports.write("profile", browser.profile);
        ports.renderProfile();
        ports.dialog().close();
        ports.toast("Contexto salvo no servidor.");
      } catch (error) {
        this.reportError(error);
      }
    },
    async saveSettings(this: LiveController) {
      try {
        const next = {
          output: ports.field("#pref-output").value,
          code: ports.field("#pref-code").value,
          audio: ports.field("#pref-audio").value,
          source: ports.field("#pref-source").value,
          instructions: ports.field("#pref-instructions").value,
        };
        const result = readPreferencesResult(
          await ports.api.request("/preferences", {
            method: "PUT",
            body: next,
          }),
        );
        browser.preferences = result.preferences;
        ports.write("preferences", browser.preferences);
        ports.dialog().close();
        ports.toast("Preferências salvas.");
      } catch (error) {
        this.reportError(error);
      }
    },
    async saveText(this: LiveController) {
      try {
        const id = await this.ensureSession();
        await ports.api.request("/sessions/" + id + "/transcripts", {
          method: "POST",
          body: {
            text: ports.field("#live-transcript").value,
            who: ports.field("#live-speaker").value,
            time: ports.formatTime(browser.session.elapsed),
            source: "manual",
            segmentId: ports.randomUUID(),
          },
        });
        ports.dialog().close();
        await this.refreshSession();
        ports.toast("Fala adicionada.");
      } catch (error) {
        this.reportError(error);
      }
    },
    async transcribeFile(this: LiveController) {
      const file = ports.field("#live-audio-file").files?.[0];
      if (!file) {
        ports.toast("Escolha um arquivo de áudio.");
        return;
      }
      if (file.size > 24 * 1024 * 1024) {
        ports.toast("Use um arquivo de até 24 MB.");
        return;
      }
      const button = ports.button('[data-live-action="transcribe-file"]');
      button.disabled = true;
      button.textContent = "Transcrevendo…";
      try {
        const id = await this.ensureSession(),
          body = new FormData();
        body.append("file", file);
        body.append("segmentId", ports.randomUUID());
        body.append("language", browser.preferences.audio);
        body.append("who", ports.field("#live-audio-speaker").value || "Áudio");
        body.append("time", ports.formatTime(browser.session.elapsed));
        const result = readTranscription(
          await ports.api.request("/sessions/" + id + "/transcribe", {
            method: "POST",
            body,
          }),
        );
        ports.dialog().close();
        await this.refreshSession();
        ports.toast(
          result.text ? "Áudio transcrito." : "Nenhuma fala reconhecida.",
        );
      } catch (error) {
        this.reportError(error);
      } finally {
        button.disabled = false;
        button.textContent = "Transcrever";
      }
    },
  };
}
