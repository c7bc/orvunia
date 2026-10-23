import { type BrowserContext, type LiveController } from "./contracts.js";

export function createSessionViewMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<LiveController, "renderSession"> {
  return {
    renderSession(this: LiveController) {
      ports.element("#timer").textContent = ports.formatTime(
        browser.session.elapsed,
      );
      const label = this.recording
        ? "Gravando áudio"
        : browser.session.paused
          ? "Gravação pausada"
          : browser.ended
            ? "Sessão encerrada"
            : browser.session.active
              ? "Sessão aberta"
              : "Pronto para começar";
      ports
        .element("#session-status")
        .classList.toggle("running", this.recording);
      ports.element("#session-status").innerHTML =
        `<span class="status-dot"></span>${label}`;
      ports.element("#start-button").innerHTML =
        ports.icon(this.recording ? "pause" : "play") +
        (this.recording
          ? "Pausar áudio"
          : browser.session.paused
            ? "Retomar áudio"
            : "Gravar áudio");
      ports.element("#stop-button").hidden = !browser.session.active;
      ports.element("#listening-indicator").hidden =
        !this.recording && this.pendingChunks === 0;
      ports.element("#listening-indicator>span").textContent = this
        .pendingChunks
        ? `Transcrevendo ${this.pendingChunks} trecho(s)…`
        : "Gravando áudio…";
    },
  };
}
