import type {
  NativeApplicationEvent,
  NativeEventPorts,
} from "./events-contracts.js";
import { eventFailure } from "./events-contracts.js";

export function createNativeEventHandler(ports: NativeEventPorts) {
  const { state } = ports;
  let disposed = false,
    selection = 0;
  async function receive(event: NativeApplicationEvent) {
    if (disposed) return;
    const { type, data } = event;
    if (type === "prepare-quit") {
      const ok = await ports.shutdown.prepare();
      await ports.native.flushComplete({ ticket: data.ticket, ok });
      return;
    }
    if (type === "quit-cancelled") {
      ports.shutdown.cancel();
      ports.resumeAutomatic?.();
      void ports.native.reminders(state.agenda);
      return;
    }
    if (ports.shutdown.active()) return;
    if (type === "window-motion") {
      const finished = await ports.motion.play(data.phase);
      if (!disposed && finished && data.phase === "exit" && data.ticket)
        await ports.native.motionComplete(data.ticket);
      return;
    }
    if (type === "state") {
      const previous = state.desktop.settings;
      state.desktop = data;
      if (state.view === "overlay" &&
        (previous.transcribeMicrophone !== data.settings.transcribeMicrophone ||
          previous.microphone !== data.settings.microphone ||
          previous.systemAudioDevice !== data.settings.systemAudioDevice ||
          previous.systemAudio !== data.settings.systemAudio))
        await ports.listening.configure?.();
      const locale = data.settings.uiLocale;
      if (typeof locale === "string" && ports.locale() !== locale)
        ports.setLocale(locale, { notify: false });
      if (data.gaze?.enabled === false && ports.gaze.status().nativeEnabled)
        ports.gaze.stop();
      ports.resumeAutomatic?.();
      if (!state.busy && !ports.motion.exiting()) ports.render();
    }
    if (type === "navigate") {
      const epoch = ++selection;
      state.page = data;
      state.accountOpen = false;
      await ports.sync();
      if (!disposed && epoch === selection) ports.render();
    }
    if (type === "session") {
      const epoch = ++selection,
        workspace = ports.workspace();
      if ((state.current?.id || null) !== (data?.id || null)) {
        ports.lifecycle.reset();
        void ports.listening.select(data?.id || null).catch((error) => {
          if (!disposed) ports.toast(eventFailure(error));
        });
      }
      if (!data) ports.gaze.stop();
      await ports.sync();
      if (disposed || epoch !== selection || ports.workspace() !== workspace)
        return;
      const current = data ? await ports.session(data.id) : null;
      if (disposed || epoch !== selection || ports.workspace() !== workspace)
        return;
      state.current = current;
      state.started = current?.state === "active" ? ports.clock() : 0;
      state.elapsedBase = current?.elapsed || 0;
      state.tab = "answers";
      ports.render();
      if (state.view === "overlay" && current?.state === "active") {
        if (await ports.prepareRepository?.(current.id)) return;
        await ports.listening.automatic?.(current.id);
      }
    }
    if (type === "shortcut" && state.view === "overlay") {
      if (data === "ask") await ports.ask("assist");
      if (data === "capture") {
        if (state.source) await ports.capture(state.source.id, false);
        else await ports.chooseSource();
      }
      if (data === "clear") ports.clear();
      if (data === "pause") await ports.pause();
      if (data === "scrollUp" || data === "scrollDown")
        ports.document.querySelector("#answer-area")?.scrollBy({
          top: data === "scrollUp" ? -230 : 230,
          behavior: "smooth",
        });
    }
  }
  return {
    async receive(event: NativeApplicationEvent) {
      try {
        await receive(event);
      } catch (error) {
        if (!disposed) ports.toast(eventFailure(error));
      }
    },
    dispose() {
      disposed = true;
      selection++;
    },
  };
}
