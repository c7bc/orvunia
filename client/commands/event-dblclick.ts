import {
  commandError,
  datasetValue,
  type CommandEventContext,
  type CommandEvents,
} from "./event-types.js";
export function bindDesktopDblclick(
  context: CommandEventContext,
  events: CommandEvents,
) {
  const { state: browser, ports } = context;
  events.on("dblclick", async (e) => {
    const origin = e.target as HTMLElement | null;
    if (!origin) return;
    const target = origin.closest<HTMLElement>("[data-shortcut-reset]");
    if (!target) return;
    e.preventDefault();
    if (!ports.native) {
      ports.toast("Somente no desktop");
      return;
    }
    try {
      browser.desktop = await ports.native.shortcutReset(
        datasetValue(target.dataset.shortcutReset),
      );
      ports.render();
      ports.toast("Atalho padrão restaurado.");
    } catch (error) {
      ports.toast(commandError(error));
    }
  });
}
