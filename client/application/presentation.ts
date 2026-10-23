import type { ApplicationState } from "./model.js";
import { escapeHtml as escape } from "../design/html.js";
import { compatibilitySelect } from "../panel/compatibility-controls.js";
import { renderCompatibilitySettings } from "../panel/compatibility-settings.js";
import { renderProfileForm } from "../panel/profile.js";
import { renderAgenda } from "../panel/agenda.js";
import { desktopActions as actions } from "./actions.js";
import type { ModeBase } from "../panel/data.js";

export type PresentationPorts = {
  state: ApplicationState;
  clock(): number;
  locale(): string;
  translate(value: string): string;
  icon(name: string, size?: number): string;
};
export function createApplicationPresentation(ports: PresentationPorts) {
  const { state, icon } = ports,
    t = ports.translate;
  const modeName = (id: string) => {
    const mode = state.modes.find((item) => item.id === id);
    if (mode)
      return mode.builtin && ["Geral", "Entrevista técnica"].includes(mode.name)
        ? t(mode.name)
        : mode.name;
    return t(
      id === "technical" ? "Entrevista técnica" : "Conversa com recrutador",
    );
  };
  const modeBase = (id: string) =>
    state.modes.find((item) => item.id === id)?.base ||
    (id === "technical" ? "technical" : "recruiter");
  const editedMode = () =>
    state.modes.find((item) => item.id === state.modeEditor) || null;
  const time = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const duration = () =>
    state.elapsedBase +
    (state.started ? Math.floor((ports.clock() - state.started) / 1000) : 0);
  const date = (value: string) =>
    new Date(value).toLocaleString(ports.locale(), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const button = (text: string, action: string, kind = "", symbol = "") =>
    `<button class="btn ${kind}" data-action="${action}">${symbol ? icon(symbol, 15) : ""}${text}</button>`;
  const iconButton = (name: string, action: string, title: string) =>
    `<button class="icon-btn" data-action="${action}" title="${title}" aria-label="${title}">${icon(name, 16)}</button>`;
  const toggle = (key: string, value: boolean | undefined) =>
    `<button class="toggle ${value ? "on" : ""}" role="switch" aria-checked="${!!value}" aria-label="${escape(key)}" data-setting="${key}"></button>`;
  const select = (
    key: string,
    values: (string | [string, string])[],
    value: string,
  ) => compatibilitySelect(escape, key, values, value);
  const profileForm = (modal = true) =>
    renderProfileForm({ profile: state.profile, escape, button }, modal);
  const settingsContent = () => {
    const content = renderCompatibilitySettings({
      settingsTab: state.settingsTab,
      settings: state.desktop.settings,
      ...(state.desktop.distribution ? { distribution: state.desktop.distribution } : {}),
      uiLocale: ports.locale(),
      failedShortcuts: state.desktop.failedShortcuts,
      preferences: state.prefs,
      health: state.health,
      escape,
      icon,
      button,
      toggle,
      profileForm,
    });
    if (content === undefined)
      throw Error("A configuração selecionada não existe.");
    return content;
  };
  const agendaView = () =>
    renderAgenda(
      {
        agenda: state.agenda,
        button,
        icon,
        date,
        modeName,
        iconButton,
        escape,
      },
      ports.clock(),
    );
  const actionTitle = (action: string, mode: ModeBase = state.current?.mode ?? modeBase(state.selectedMode)) =>
    t(actions[mode].find(item => item[0] === action)?.[1]
      || Object.values(actions).flat().find(item => item[0] === action)?.[1] || "Resposta");
  return {
    modeName,
    modeBase,
    editedMode,
    time,
    duration,
    date,
    button,
    iconButton,
    toggle,
    select,
    profileForm,
    settingsContent,
    agendaView,
    actionTitle,
    escape,
    actions,
  };
}
