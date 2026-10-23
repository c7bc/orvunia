import type { ApplicationContext } from "./context.js";
import { createBroadcastHandler } from "./broadcast.js";
import { createNativeEventHandler } from "./native-events.js";
import { createApplicationTimers } from "./timers.js";
import { applicationSession } from "./decoders.js";
import { createApplicationEventDispatch } from "./event-dispatch.js";
import { installAuxiliarySource } from "../auxiliary/source.js";
export function installApplicationEffects(context: ApplicationContext) {
  const { state, environment } = context,
    { document, window } = environment;
  const ports = {
    state,
    document,
    clock: environment.clock,
    workspace: () => state.workspaceKey,
    render: () => context.rendering.render(),
    sync: () => context.synchronization.sync(),
    syncSession: (id: string) => context.synchronization.session(id),
    toast: context.modal.toast,
    listen: context.audioFeature.listening.toggle,
    ask: context.answer.ask,
    end: context.lifecycle.end,
    refreshActivity: () => context.rendering.refreshActivity(),
    cancelPrepared: () => context.coding.prepared.cancel(),
    acceptTranscript: context.transcripts.accept,
    partialTranscript: context.transcripts.partial,
  };
  const broadcast = createBroadcastHandler(ports);
  const native = context.native
    ? createNativeEventHandler({
        ...ports,
        native: context.native,
        shutdown: context.shutdown,
        motion: {
          play: context.layout.motion.play,
          exiting: context.layout.motion.exiting,
        },
        locale: environment.locale,
        setLocale: environment.setLocale,
        gaze: context.connections.gaze,
        lifecycle: context.lifecycle,
        listening: context.audioFeature.listening,
        prepareRepository: id => context.repository.prepareSession(id),
        resumeAutomatic: context.transcripts.resume,
        session: async (id) =>
          applicationSession(await context.request("/sessions/" + id)),
        capture: context.captures.capture,
        chooseSource: context.captures.chooseSource,
        clear: context.dialogs.clear,
        pause: context.lifecycle.pause,
      })
    : null;
  const dispatch = createApplicationEventDispatch({
    commands: context.commands,
    broadcast: broadcast.receive,
    native: native?.receive || null,
  });
  environment.broadcast.onmessage = ({ data }: MessageEvent<unknown>) => {
    void dispatch.broadcast(data);
  };
  const unsubscribe = context.native?.onEvent(dispatch.native);
  const auxiliary = state.view === "overlay" && context.native?.auxiliary
    ? installAuxiliarySource({ document, window, transport: context.native.auxiliary,
      active: () => state.view === "overlay" && (Boolean(state.current) || state.desktop.settings.ambientChat === true),
      locale: environment.locale,
      changed: () => context.layout.updateSize(),
      failed: () => context.modal.toast(environment.translate("Não foi possível abrir as opções em outra janela.")),
    }) : null;
  const timers = createApplicationTimers({
    state,
    document,
    clock: environment.clock,
    duration: context.presentation.duration,
    time: context.presentation.time,
    refreshActivity: () => context.rendering.refreshActivity(),
    elapsed: (id, elapsed) =>
      context.request(`/sessions/${id}`, "PATCH", { elapsed }),
    repeat: (callback, delay) => window.setInterval(callback, delay),
    clear: (timer) => window.clearInterval(timer),
  });
  const unwatchMicrophones = context.microphone.watch();
  const observers = ["#app", "#dialogs"].map((selector) =>
    environment.observeUI(document.querySelector<HTMLElement>(selector)),
  );
  let disposed = false;
  function locale() {
    state.accountMarkup = {};
    context.rendering.render();
    environment.translateUI(document.querySelector("#dialogs"));
    if (context.native)
      void context.native
        .settings({ uiLocale: environment.locale() })
        .then((value) => {
          if (!disposed) state.desktop = value;
        })
        .catch((error) => {
          if (!disposed)
            context.modal.toast(
              error instanceof Error
                ? error.message
                : "Não foi possível salvar o idioma.",
            );
        });
  }
  window.addEventListener("cadence:locale", locale);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      broadcast.dispose();
      native?.dispose();
      unsubscribe?.();
      auxiliary?.dispose();
      timers.dispose();
      unwatchMicrophones();
      environment.broadcast.onmessage = null;
      window.removeEventListener("cadence:locale", locale);
      for (const observer of observers)
        if (typeof observer === "function") observer();
    },
  };
}
