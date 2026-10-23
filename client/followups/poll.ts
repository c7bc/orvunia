import { stateValue } from "./boundary";
import { deliveryLabels } from "./render";
import { t } from "@cadence/i18n";
import type { FollowupOptions, FollowupPlatform } from "./contracts";
export function followupPolling(
  options: FollowupOptions,
  platform: FollowupPlatform,
) {
  let stop = () => {},
    generation = 0;
  function cancel() {
    generation++;
    stop();
    stop = () => {};
  }
  function start(sessionId: string, form: HTMLFormElement) {
    cancel();
    const ticket = generation,
      workspace = options.workspace();
    let attempts = 0;
    const active = () =>
      ticket === generation &&
      form.isConnected &&
      options.current()?.id === sessionId &&
      options.workspace() === workspace;
    async function refresh() {
      if (!active() || ++attempts > 120) return;
      try {
        const state = stateValue(
          await options.api(`/sessions/${sessionId}/followup`),
        );
        if (!active()) return;
        const label = form.querySelector<HTMLElement>(
          "[data-followup-delivery]",
        );
        if (label && state.delivery) {
          label.hidden = false;
          label.textContent = t(deliveryLabels[state.delivery.status]);
        }
        if (state.delivery?.status !== "sending") return;
      } catch {
        if (!active()) return;
      }
      stop = platform.schedule(() => {
        void refresh();
      }, 1500);
    }
    stop = platform.schedule(() => {
      void refresh();
    }, 1500);
  }
  return { start, cancel };
}
