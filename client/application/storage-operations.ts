import type { ApplicationContext } from "./context.js";
import type { CommandSettings } from "../commands/model.js";
import { applicationLibrary } from "./decoders.js";
import { saveApplicationAgenda } from "../application-services/agenda.js";
export function createApplicationStorageOperations(
  context: Pick<
    ApplicationContext,
    "state" | "environment" | "native" | "request" | "rendering" | "audioFeature"
  >,
) {
  const { state, environment } = context;
  async function setDesktop(change: Partial<CommandSettings>) {
    if (context.native) state.desktop = await context.native.settings(change);
    else {
      state.desktop.settings = { ...state.desktop.settings, ...change };
      environment.window.localStorage.setItem(
        "cadence-desktop-preview",
        JSON.stringify(state.desktop.settings),
      );
    }
    if (!context.native && ("microphone" in change || "systemAudioDevice" in change || "transcribeMicrophone" in change || "systemAudio" in change))
      await context.audioFeature.listening.configure();
    context.rendering.render();
  }
  async function saveLibrary() {
    const workspace = state.workspaceKey,
      library = applicationLibrary(
        await context.request("/library", "PUT", state.library),
      );
    if (state.workspaceKey !== workspace) return;
    state.library = library;
    environment.broadcast.postMessage({ type: "changed" });
    context.rendering.render();
  }
  function saveAgenda() {
    saveApplicationAgenda({
      state,
      storage: environment.window.localStorage,
      reminders: (value) => context.native?.reminders(value),
    });
  }
  return { setDesktop, saveLibrary, saveAgenda };
}
