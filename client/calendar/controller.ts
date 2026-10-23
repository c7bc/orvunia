import { t } from "@cadence/i18n";
import { googleIntegrationAvailable } from "../google/availability";
import type {
  CalendarOptions,
  CalendarState,
  UpcomingOptions,
} from "./contracts";
import {
  calendarError,
  calendarState,
  record,
  safeCalendarUrl,
} from "./boundary";
import { browserCalendarRequest } from "./browser";
import { renderCalendarSettings, renderUpcomingEvents } from "./render";
export function createCalendarController({
  integrationAvailable = googleIntegrationAvailable,
  api = browserCalendarRequest,
  toast = () => {},
  onChange = () => {},
  onOpenURL = (url) => location.assign(url),
  onStart = () => {},
  confirmDisconnect = () =>
    window.confirm(
      t("Desconectar a agenda e remover os eventos salvos deste aplicativo?"),
    ),
}: CalendarOptions = {}) {
  let state: CalendarState = {
    configured: false,
    connected: false,
    events: [],
  };
  let busy = false,
    generation = 0;
  async function load({ refresh = false }: { refresh?: boolean } = {}) {
    if (!integrationAvailable) return state;
    const started = ++generation;
    const next = calendarState(
      await api(
        refresh ? "/calendar/sync" : "/calendar",
        refresh ? "POST" : "GET",
      ),
    );
    if (started !== generation) return state;
    state = next;
    await onChange(state);
    return state;
  }
  function bind(root: Element) {
    const abort = new AbortController();
    const handle = async (event: Event) => {
      const target = event.target as Element | null;
      const button = target?.closest?.(
        "[data-calendar],[data-calendar-start],[data-calendar-open]",
      ) as HTMLButtonElement | null;
      if (!button || !root.contains(button) || button.disabled || !integrationAvailable) return;
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;
      busy = true;
      button.disabled = true;
      try {
        if (button.dataset.calendarStart !== undefined) {
          const selected = state.events[Number(button.dataset.calendarStart)];
          if (selected) await onStart(selected);
          return;
        }
        if (button.dataset.calendarOpen) {
          const [kind, index] = button.dataset.calendarOpen.split(":"),
            selected = state.events[Number(index)];
          const url = kind === "join" ? selected?.joinUrl : selected?.url;
          if (url) await onOpenURL(safeCalendarUrl(url));
          return;
        }
        if (button.dataset.calendar === "connect") {
          const result = record(await api("/calendar/connect", "POST"));
          if (!abort.signal.aborted)
            await onOpenURL(safeCalendarUrl(result.url, true));
        }
        if (button.dataset.calendar === "sync") {
          await load({ refresh: true });
          toast(t("Agenda atualizada."));
        }
        if (
          button.dataset.calendar === "disconnect" &&
          (await confirmDisconnect())
        ) {
          const started = ++generation,
            next = calendarState(await api("/calendar", "DELETE"));
          if (!abort.signal.aborted && started === generation) {
            state = next;
            await onChange(state);
            toast(t("Agenda desconectada deste aplicativo."));
          }
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          toast(t(calendarError(error)));
          try {
            await load();
          } catch {}
        }
      } finally {
        busy = false;
        button.disabled = false;
      }
    };
    root.addEventListener("click", handle, { signal: abort.signal });
    return () => {
      abort.abort();
      root.removeEventListener("click", handle);
      generation++;
    };
  }
  return {
    load,
    bind,
    renderSettings: () => renderCalendarSettings(state, integrationAvailable),
    renderUpcoming: (options?: UpcomingOptions) =>
      renderUpcomingEvents(state, options),
    get state() {
      return state;
    },
    get busy() {
      return busy;
    },
  };
}
