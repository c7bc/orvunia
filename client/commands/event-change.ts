import { commandEditedMode } from "./guards.js";
import { commandScope } from "./scope.js";
import { requireCommandSession } from "./model.js";
import { commandSession } from "./boundary.js";

import {
  commandError,
  type CommandEventContext,
  type CommandEvents,
} from "./event-types.js";
export function bindDesktopChange(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("change", async (e) => {
    const target = e.target as HTMLInputElement | null;
    if (!target) return;
    try {
      if (target.matches("[data-ui-locale]")) {
        ports.setLocale(target.value);
        return;
      }
      if (target.matches("[data-selected-mode]")) {
        await ports.activateMode(target.value);
      }
      if (target.matches("[data-mode-name]")) {
        const name = target.value.trim();
        if (!name) {
          target.value = commandEditedMode(ports).name;
          throw Error("Informe um nome para o modo.");
        }
        await ports.saveEditedMode({ name });
      }
      if (target.matches("[data-mode-base]")) {
        ports.captureModeDraft();
        await ports.saveEditedMode({ base: target.value });
        ports.render();
      }
      if (target.dataset.pref) {
        const key = target.dataset.pref;
        if (key === "mode") {
          const sessionId = browser.current?.id,
            workspace = ports.workspace();
          await ports.activateMode(target.value);
          if (!events.active() || workspace !== ports.workspace()) return;
          if (sessionId && browser.current?.id === sessionId) {
            const scope = commandScope(context);
            const updated = commandSession(
              await ports.request(
                `/sessions/${requireCommandSession(browser).id}`,
                "PATCH",
                {
                  mode: ports.modeBase(target.value),
                  modeId: target.value,
                },
              ),
            );
            if (!events.active() || !scope.current()) return;
            browser.current = updated;
            ports.broadcast({ type: "changed" });
            ports.render();
          } else ports.render();
        } else {
          browser.prefs[key] = target.value;
          await ports.request("/preferences", "PUT", browser.prefs);
          ports.broadcast({ type: "changed" });
          ports.toast("Preferência salva.");
        }
      }
      if (target.dataset.desktopSelect) {
        const key = target.dataset.desktopSelect;
        await ports.setDesktop({
          [key]: key === "chunkSeconds" || key === "answerPauseSeconds" ? Number(target.value) : target.value,
        });
      }
      if (target.matches("[data-opacity]"))
        await ports.setDesktop({ opacity: Number(target.value) });
      if (target.id === "microphone")
        await ports.setDesktop({ microphone: target.value });
    } catch (error) {
      ports.toast(commandError(error));
    }
  });
}
