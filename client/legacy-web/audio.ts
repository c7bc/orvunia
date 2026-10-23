import {
  requiredHealth,
  type BrowserContext,
  type LiveController,
} from "./contracts.js";

export function createAudioMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<LiveController, "start"> {
  return {
    async start(this: LiveController) {
      try {
        if (this.recording) {
          await this.audio.stop();
          this.recording = false;
          browser.session.paused = true;
          await ports.api.request("/sessions/" + this.sessionId, {
            method: "PATCH",
            body: { state: "paused", elapsed: browser.session.elapsed },
          });
          ports.renderSession();
          return;
        }
        if (!requiredHealth(this).keyConfigured)
          throw new Error("Configure a chave da OpenAI no servidor.");
        await this.ensureSession();
        await this.audio.start(
          browser.preferences.source,
          async (blob) => {
            const body = new FormData();
            const extension = blob.type.includes("mp4") ? "m4a" : "webm";
            body.append(
              "file",
              blob,
              `${browser.preferences.source === "display" ? "call" : "microphone"}.${extension}`,
            );
            body.append("segmentId", ports.randomUUID());
            body.append("language", browser.preferences.audio);
            body.append(
              "who",
              browser.preferences.source === "display"
                ? "Áudio da chamada"
                : "Áudio do microfone",
            );
            body.append("time", ports.formatTime(browser.session.elapsed));
            await ports.api.request(
              "/sessions/" + this.sessionId + "/transcribe",
              { method: "POST", body },
            );
            await this.refreshSession();
          },
          (state, detail) => {
            if (state === "queued") {
              this.pendingChunks = typeof detail === "number" ? detail : 0;
              ports.renderSession();
            }
            if (["ended", "backpressure", "error"].includes(state)) {
              this.recording = false;
              browser.session.paused = true;
              ports.renderSession();
              ports.toast(
                state === "ended"
                  ? "A fonte de áudio foi encerrada."
                  : String(detail ?? ""),
              );
              void ports.api
                .request("/sessions/" + this.sessionId, {
                  method: "PATCH",
                  body: { state: "paused", elapsed: browser.session.elapsed },
                })
                .catch((error) => this.reportError(error));
            }
          },
        );
        this.recording = true;
        browser.session.paused = false;
        await ports.api.request("/sessions/" + this.sessionId, {
          method: "PATCH",
          body: { state: "active" },
        });
        ports.renderSession();
      } catch (error) {
        this.recording = false;
        await this.audio.stop();
        this.reportError(error);
        ports.renderSession();
      }
    },
  };
}
