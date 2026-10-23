import type { ApplicationState } from "./model.js";
import type { ApplicationStorage } from "./storage.js";
import { applicationDesktop } from "./desktop-state.js";
import { applicationSession } from "./decoders.js";
import { eventFailure } from "./events-contracts.js";
import { record } from "../legacy-web/validation.js";

export function createApplicationStartup(ports: {
  state: ApplicationState;
  storage: ApplicationStorage;
  search: string;
  native: {
    state(value: { capabilities: string[] }): Promise<unknown>;
    reminders(value: ApplicationState["agenda"]): Promise<unknown>;
  } | null;
  sync(): Promise<unknown>;
  gate(): Promise<boolean>;
  locale(value: string): void;
  request(path: string): Promise<unknown>;
  clock(): number;
  refreshBilling(): Promise<unknown>;
  loadCalendar(): Promise<unknown>;
  resumeListening?(sessionId: string): Promise<void>;
  prepareRepository?(sessionId: string): Promise<boolean>;
  replaceLocation(path: string): void;
  render(): void;
  toast(message: string): void;
  failed(message: string, retry: () => Promise<void>): void;
}) {
  const { state } = ports;
  let generation = 0,
    disposed = false;
  async function init() {
    if (disposed) return;
    const epoch = ++generation,
      active = () => !disposed && epoch === generation;
    let restoredSession: string | null = null;
    try {
      if (ports.native) {
        const desktop = applicationDesktop(
          await ports.native.state({ capabilities: ["renderer-drain/1"] }),
        );
        if (!active()) return;
        state.desktop = desktop;
        if (typeof desktop.settings.uiLocale === "string")
          ports.locale(desktop.settings.uiLocale);
      }
      if (state.view === "panel" && (await ports.gate())) return;
      if (!active()) return;
      await ports.sync();
      if (!active()) return;
      if (ports.native) {
        if (state.desktop.active) {
          const current = applicationSession(
            await ports.request("/sessions/" + state.desktop.active.id),
          );
          if (!active()) return;
          state.current = current;
          restoredSession = current.id;
          state.started = current.state === "active" ? ports.clock() : 0;
          state.elapsedBase = current.elapsed;
        }
      } else {
        if (state.view === "panel")
          state.current =
            state.sessions.find(
              (session) =>
                session.state === "active" || session.state === "paused",
            ) || null;
        const saved = ports.storage.getItem("cadence-desktop-preview");
        if (saved)
          state.desktop = applicationDesktop({
            ...state.desktop,
            settings: {
              ...state.desktop.settings,
              ...record(JSON.parse(saved)),
            },
          });
        const selected = new URLSearchParams(ports.search).get("session");
        if (selected) {
          try {
            const current = applicationSession(
              await ports.request("/sessions/" + selected),
            );
            if (!active()) return;
            state.current = current;
            state.elapsedBase = current.elapsed;
            state.started = current.state === "active" ? ports.clock() : 0;
          } catch (error) {
            if (!active()) return;
            if (
              error &&
              typeof error === "object" &&
              "status" in error &&
              error.status !== 404
            )
              throw error;
            state.current = null;
            state.view = "panel";
            state.page = "sessions";
            ports.replaceLocation("/desktop.html");
            ports.toast(
              "Esta sessão não está disponível neste espaço. Escolha outra ou inicie uma nova.",
            );
          }
        }
      }
      await ports.refreshBilling();
      if (!active()) return;
      await ports.loadCalendar().catch(() => {});
      if (!active()) return;
      ports.render();
      void ports.native?.reminders(state.agenda).catch((error) => {
        if (active()) ports.toast(eventFailure(error));
      });
      const repositoryPending = active() && ports.native && state.view === "overlay" && restoredSession
        && state.current?.state === "active" ? await ports.prepareRepository?.(restoredSession) : false;
      if (!repositoryPending && active() && ports.native && state.view === "overlay" && state.desktop.settings.autoListen === true &&
        restoredSession && state.current?.id === restoredSession && state.current.state === "active") {
        try { await ports.resumeListening?.(restoredSession); }
        catch (error) { if (active()) ports.toast(eventFailure(error)); }
      }
    } catch (error) {
      if (active()) ports.failed(eventFailure(error), init);
    }
  }
  return {
    init,
    dispose() {
      disposed = true;
      generation++;
    },
  };
}
