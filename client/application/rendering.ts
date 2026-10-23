import type { ApplicationRendering } from "./context.js";
import type { RenderContext } from "../application-render/render-context.js";
import { refreshAudioStatus } from "../audio-status/render.js";
import {
  createActivityPresentation,
  createPanelState,
  createOverlayState,
  createTranscriptPresentation,
  createApplicationRenderer,
} from "../application-render/index.js";
import { renderPanel } from "../panel/index.js";
import { renderHistoryNavigation } from "../panel/paging.js";
import { renderOverlay, renderOverlayControl } from "../overlay/render.js";
import { formatAccountActivity } from "../format/activity.js";
import { historyTotal } from "../history/view.js";
import { createChatSpeechPresentation } from "../application-render/chat-speech.js";
import {
  sectionsFromTemplate,
  serializeNoteSections,
} from "../application-services/sections.js";
export function createApplicationRendering(
  context: RenderContext,
): ApplicationRendering {
  const { state, environment } = context,
    { document, window } = environment,
    presentation = context.presentation,
    views = context.coding.views;
  const activity = createActivityPresentation({
    document,
    current: () => state.current,
    clock: environment.clock,
    origin: () => state.audioTimeOrigin,
    voice: state.voiceActivity,
    partials: state.partialTranscripts,
    escape: presentation.escape,
    translate: environment.translate,
    translateUI: environment.translateUI,
  });
  const refreshActivity = () => {
    activity.refresh();
    chatSpeech.refresh();
    refreshAudioStatus(document, state, environment.translate);
    context.layout.updateSize();
  };
  const panel = createPanelState({
    read: () => ({
      ...state,
      desktop: { ...state.desktop, native: !!context.native },
      native: !!context.native,
      navigationLength: state.navigationTrail.length,
    }),
    ...presentation,
    icon: environment.icon,
    esc: presentation.escape,
    ib: presentation.iconButton,
    markdown: context.markdown.markdown,
    codingAttemptView: views.attemptView,
    codingResponseActions: views.responseActions,
    historyPager: context.historyPager,
    modeDraft: (key) => state.modeDrafts.get(key),
    sections: sectionsFromTemplate,
    serializeSections: serializeNoteSections,
    cloud: () => context.connections.welcome.deployment.mode === "cloud",
    locale: environment.locale,
    translate: environment.translate,
    activity: activity.state,
    detailDraft: (key) => state.detailDrafts.get(key) || "",
    formatActivity: (value, locale) => formatAccountActivity(value, { locale }),
    account: () => context.connections.welcome.account?.user || null,
    accountMarkup: (key) => state.accountMarkup[key],
    renderProviderSettings: () => {
      if (!state.providerState)
        throw Error("As conexões de IA ainda não foram carregadas.");
      return context.connections.renderProviders();
    },
    renderBillingSettings: () => context.connections.renderBilling(),
    renderCalendarSettings: () => context.connections.calendar.renderSettings(),
    renderCalendarUpcoming: () =>
      context.connections.calendar.renderUpcoming({
        limit: 4,
        showHeading: false,
      }),
    renderGazeSettings: () => context.connections.gaze.renderSettings(),
    renderModeRepository: modeId => context.repository.preparation.render(modeId),
  });
  const overlay = createOverlayState({
    read: () => ({
      ...state,
      ...presentation,
      modeBase: presentation.modeBase,
      audio: context.audio,
      translate: environment.translate,
      historyPager: context.historyPager,
      esc: presentation.escape,
      icon: environment.icon,
      ib: presentation.iconButton,
      markdown: context.markdown.markdown,
      codingResponseActions: views.responseActions,
      codingAttemptView: views.attemptView,
    }),
    coding: (key) => context.coding.coding.get(key),
  });
  const chatSpeech = createChatSpeechPresentation({ document, current: overlay,
    visible: () => state.view === "overlay" && state.tab === "answers" });
  const selected = () => {
    if (!state.current)
      throw Error("Selecione uma sessão para abrir o histórico.");
    return state.current;
  };
  const transcript = createTranscriptPresentation({
    document,
    tab: () => state.tab,
    currentId: () => state.current?.id,
    partials: state.partialTranscripts,
    page: () =>
      context.historyPager.page(selected(), "transcripts", {
        view: "overlay-transcripts",
      }),
    total: () => historyTotal(state.current, "transcripts"),
    panel,
    navigation: renderHistoryNavigation,
    escape: presentation.escape,
    icon: environment.icon,
    broadcast: (value) => environment.broadcast.postMessage(value),
    refreshActivity,
  });
  const renderer = createApplicationRenderer({
    document,
    read: () => ({
      currentId: state.current?.id,
      view: state.view,
      page: state.page,
      settingsTab: state.settingsTab,
      tab: state.tab,
      overlayMore: state.overlayMore,
      busy: state.busy,
    }),
    prepared: context.coding.prepared,
    notes: () => context.notes,
    prompt: context.prompt,
    history: context.historyDom,
    motionTarget: () => context.layout.motion.target(),
    style: (element) => window.getComputedStyle(element),
    retainMenu: (...args) => context.layout.menu.retain(...args),
    theme: context.layout.theme,
    welcomeVisible: () => context.connections.welcome.visible,
    welcomeRender: () => context.connections.welcome.render(),
    rememberNavigation: context.navigation.remember,
    controlView: () => renderOverlayControl(overlay()),
    overlayView: () => renderOverlay(overlay()),
    panelView: () => renderPanel(panel()),
    detailDraft: (key) => state.detailDrafts.get(key) || "",
    decorateMarkdown: context.markdown.decorate,
    translate: environment.translateUI,
    autosizeQuestion: context.layout.autosize,
    followingLatest: () =>
      context.historyPager.page(selected(), "responses", { view: "overlay" })
        .followingLatest,
    scrollAnswers: context.markdown.scroll,
    updateOverlaySize: context.layout.updateSize,
    bindProviders: () => context.connections.bindProviders(),
    schedule: (callback) => window.queueMicrotask(callback),
    bindCalendar: (root) => context.connections.calendar.bind(root),
    bindGaze: (root) => context.connections.gaze.bind(root),
    animateAssistant: context.layout.assistant,
    updateReviewChat: context.review.update,
    reapplyPreparedReveal: views.reapply,
    cloudAccount: () => context.connections.welcome.deployment.mode === "cloud",
    loadAccount: () => context.connections.loadAccountPanel(),
    accountView: async (section) => await context.connections.welcome.accountView?.(section) ?? "",
    accountMarkup: (section, markup) => {
      state.accountMarkup[section] = markup;
    },
    bindAccount: (root, render) =>
      context.connections.welcome.bindAccount?.(root, render),
  });
  return {
    render: renderer.render,
    panel,
    overlay,
    refreshActivity,
    refreshTranscript: transcript.refresh,
    partial: transcript.partial,
    dispose: renderer.dispose,
  };
}
