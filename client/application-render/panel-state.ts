import type { PanelState } from "../panel/state.js";
import type { PanelStatePorts } from "./state-types.js";

export function createPanelState(ports: PanelStatePorts) {
  return function panelState() {
    const values = ports.read();
    const requestMatches =
      values.activeAnswerRequest?.sessionId === values.current?.id;
    return {
      icon: ports.icon,
      esc: ports.esc,
      ib: ports.ib,
      button: ports.button,
      profile: values.profile,
      prefs: values.prefs,
      library: values.library,
      health: values.health,
      desktop: { ...values.desktop, native: values.native },
      page: values.page,
      settingsTab: values.settingsTab,
      accountOpen: values.accountOpen,
      selectedMode: values.selectedMode,
      modeEditor: values.modeEditor,
      modes: values.modes,
      modeTemplates: values.modeTemplates,
      editedMode: ports.editedMode(),
      modeBase: ports.modeBase,
      detailTab: values.detailTab,
      historyMenuId: values.historyMenuId,
      historyMenuAbove: values.historyMenuAbove,
      modeCatalog: values.modeCatalog,
      releaseVersion: values.releaseVersion,
      isCloud: ports.cloud(),
      uiLocale: ports.locale(),
      translate: ports.translate,
      canGoBack: values.navigationIndex > 0,
      canGoForward:
        values.navigationIndex >= 0 &&
        values.navigationIndex < values.navigationLength - 1,
      modeDraft: ports.modeDraft(values.modeEditor),
      noteSections: ports.sections(
        ports.modeDraft(values.modeEditor)?.notes ??
          ports.serializeSections(ports.editedMode()?.sections || []),
      ),
      current: values.current,
      historyPager: ports.historyPager,
      answerPhase: requestMatches ? values.answerPhase : "",
      reviewChatOpen: values.reviewChatSessionId === values.current?.id,
      reviewChatDraft: values.current
        ? ports.detailDraft(values.current.id)
        : "",
      answerSessionId: values.activeAnswerRequest?.sessionId,
      hasActiveSession: values.sessions.some(
        (session) => session.state === "active" || session.state === "paused",
      ),
      ...ports.activity(),
      sessions: values.sessions,
      sessionIndexBefore: values.sessionIndexBefore,
      agenda: values.agenda,
      busy: values.busy && requestMatches,
      liveText: requestMatches ? values.liveText : "",
      liveQuestion: requestMatches ? values.liveQuestion : "",
      codingResponseActions: ports.codingResponseActions,
      codingAttemptView: ports.codingAttemptView,
      date: ports.date,
      detailDate: (value: string) =>
        ports.formatActivity(value, ports.locale()),
      time: ports.time,
      duration: ports.duration,
      modeName: ports.modeName,
      search: values.search,
      actions: ports.actions,
      toggle: ports.toggle,
      settingsContent: ports.settingsContent,
      profileForm: ports.profileForm,
      agendaView: ports.agendaView,
      markdown: ports.markdown,
      actionTitle: ports.actionTitle,
      accountName:
        ports.account()?.name ||
        values.profile?.name ||
        ports.translate("Você"),
      accountEmail: ports.account()?.email || "",
      accountLocation: ports.cloud()
        ? "Orvunia Cloud"
        : "Salvo neste computador",
      renderProviderSettings: () => ports.renderProviderSettings(),
      ...(ports.renderModeRepository ? { renderModeRepository: ports.renderModeRepository } : {}),
      renderAccount: (key: string) =>
        ports.cloud()
          ? ports.accountMarkup(key) ||
            `<div class="account-loading" role="status" aria-label="${ports.esc(ports.translate("Carregando sua conta…"))}"><span class="welcome-sr-only">${ports.esc(ports.translate("Carregando sua conta…"))}</span></div>`
          : "",
      renderBillingSettings: ports.renderBillingSettings,
      renderCalendarSettings: () => ports.renderCalendarSettings(),
      renderCalendarUpcoming: () => ports.renderCalendarUpcoming(),
      renderGazeSettings: () =>
        `<div id="gaze-settings-mount">${ports.renderGazeSettings()}</div>`,
    } satisfies PanelState & {
      liveQuestion: string;
      modeBase: PanelStatePorts["modeBase"];
      answerSessionId: string | undefined;
    };
  };
}
