import { type BrowserContext, type LiveController } from "./contracts.js";

import { readSession, readSessions } from "./responses.js";
export function createSessionsMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<
  LiveController,
  | "showHistory"
  | "ensureSession"
  | "refreshSession"
  | "end"
  | "newSession"
  | "tick"
> {
  return {
    async showHistory(this: LiveController) {
      try {
        browser.history = readSessions(await ports.api.request("/sessions"));
        ports.renderProfile();
        ports.historyModal();
      } catch (error) {
        this.reportError(error);
      }
    },
    async ensureSession(this: LiveController) {
      if (this.sessionId && browser.session.active) return this.sessionId;
      if (this.creating) return this.creating;
      this.creating = (async () => {
        const s = readSession(
          await ports.api.request("/sessions", {
            method: "POST",
            body: {
              mode: browser.mode,
              title: browser.profile.job + " · Sessão de entrevista",
            },
          }),
        );
        this.sessionId = s.id;
        browser.session.active = true;
        browser.session.paused = false;
        browser.session.elapsed = 0;
        browser.session.started = s.date;
        browser.ended = false;
        ports.renderSession();
        return s.id;
      })();
      try {
        return await this.creating;
      } finally {
        this.creating = null;
      }
    },
    async refreshSession(this: LiveController) {
      if (!this.sessionId) return;
      const s = readSession(
        await ports.api.request("/sessions/" + this.sessionId),
      );
      browser.transcripts.recruiter = s.transcripts;
      browser.transcripts.technical = s.transcripts;
      browser.captures.recruiter = s.captures;
      browser.captures.technical = s.captures;
      ports.renderInput();
    },
    async end(this: LiveController) {
      if (!browser.session.active) return;
      ports.cancelGeneration();
      try {
        ports.button("#stop-button").disabled = true;
        await this.audio.stop();
        this.recording = false;
        const report = readSession(
          await ports.api.request("/sessions/" + this.sessionId, {
            method: "PATCH",
            body: { state: "ended", elapsed: browser.session.elapsed },
          }),
        );
        browser.session.active = false;
        browser.session.paused = false;
        browser.ended = true;
        browser.history = readSessions(await ports.api.request("/sessions"));
        ports.renderProfile();
        ports.renderSession();
        ports.summaryModal(report);
        ports.element(".modal-body .demo-pill").textContent =
          "SESSÃO COM OPENAI";
      } catch (error) {
        this.reportError(error);
      } finally {
        ports.button("#stop-button").disabled = false;
      }
    },
    async newSession(this: LiveController) {
      if (browser.session.active) {
        await this.end();
        if (browser.session.active) return;
      }
      if (ports.dialog().open) ports.dialog().close();
      ports.cancelGeneration();
      this.sessionId = null;
      this.answers = { recruiter: null, technical: null };
      browser.transcripts = { recruiter: [], technical: [] };
      browser.captures.recruiter = [];
      browser.captures.technical = [];
      browser.session.elapsed = 0;
      browser.ended = false;
      browser.inputTab = "transcript";
      this.practiceSelected = false;
      ports.renderMode();
      ports.toast("Nova sessão pronta.");
    },
    tick(this: LiveController) {
      if (!browser.session.active || browser.session.paused) return;
      browser.session.elapsed++;
      ports.renderSession();
      if (browser.session.elapsed % 10 === 0)
        void ports.api
          .request("/sessions/" + this.sessionId, {
            method: "PATCH",
            body: { elapsed: browser.session.elapsed },
          })
          .catch((error) => this.reportError(error));
    },
  };
}
