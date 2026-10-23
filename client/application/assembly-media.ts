import type { ApplicationContext } from "./context.js";
import { createApplicationAudio } from "./audio.js";
import { createApplicationUploads } from "./uploads.js";
import { createApplicationCaptures } from "./captures.js";
import { createApplicationAnswer } from "./answer.js";
import { applicationSession } from "./decoders.js";
import { renderAudioLabel } from "../overlay/render.js";
import { supportsNativeSystemAudio } from "../system-audio/bridge.js";

export function assembleAudio(context: ApplicationContext) {
  const { state, environment } = context;
  return createApplicationAudio({
    state,
    document: environment.document,
    audio: context.audio,
    request: context.request,
    clock: environment.clock,
    duration: context.presentation.duration,
    format: context.presentation.time,
    identifier: environment.identifier,
    accept: (...args) => context.transcripts.accept(...args),
    partial: (kind, item, text, done, sessionId, utteranceId) =>
      context.transcripts.partial(kind, item, text, done, sessionId, false, undefined, utteranceId),
    chooseSource: () => context.captures.chooseSource("audio"),
    nativeSystemAudio: supportsNativeSystemAudio,
    broadcast: (value) => environment.broadcast.postMessage(value),
    refreshActivity: () => context.rendering.refreshActivity(),
    resumeAutomatic: () => context.transcripts.resume(),
    label: () => renderAudioLabel(context.rendering.overlay()),
    render: () => context.rendering.render(),
    toast: (message) => context.modal.toast(message),
    translate: environment.translate,
  });
}
export function assembleUploads(context: ApplicationContext) {
  return createApplicationUploads({
    state: context.state,
    request: context.request,
    coding: context.coding.coding,
    render: () => context.rendering.render(),
    toast: (message) => context.modal.toast(message),
    changed: () =>
      context.environment.broadcast.postMessage({ type: "changed" }),
  });
}
export function assembleCaptures(context: ApplicationContext) {
  const { environment } = context;
  return createApplicationCaptures({
    state: context.state,
    document: environment.document,
    native: context.native,
    fetch: environment.fetch,
    display: (options) =>
      environment.window.navigator.mediaDevices.getDisplayMedia(options),
    escape: context.presentation.escape,
    button: context.presentation.button,
    modal: (...args) => context.modal.modal(...args),
    close: () => context.modal.close(),
    toast: (message) => context.modal.toast(message),
    startAudio: () => context.audioFeature.listening.start(),
    save: (...args) => context.uploads.save(...args),
  });
}
export function assembleAnswer(context: ApplicationContext) {
  const { state, environment } = context;
  return createApplicationAnswer({
    state,
    document: environment.document,
    native: !!context.native,
    decorateMarkdown: root => context.markdown.decorateContent(root),
    repositoryAsk: (...args) => context.repository.ask(...args),
    coding: context.coding.coding,
    audio: context.audio,
    tellMore: context.coding.tellMore,
    latest(session) {
      const current = state.current;
      if (current?.id === session.id)
        context.historyPager.move(current, "responses", "latest", {
          view:
            state.view === "overlay"
              ? "overlay"
              : state.reviewChatSessionId
                ? "review-chat"
                : "panel-conversation",
          ...(state.view === "overlay"
            ? {}
            : { filter: (response) => response.action !== "recap" }),
        });
    },
    identify: environment.identifier,
    begin: async (...args) => {
      await context.lifecycle.begin(...args);
    },
    modeName: context.presentation.modeName,
    broadcast: (value) => environment.broadcast.postMessage(value),
    render: () => context.rendering.render(),
    toast: (message) => context.modal.toast(message),
    sync: () => context.synchronization.session(),
    capture: (source) => context.captures.capture(source, false),
    session: async (id) =>
      applicationSession(await context.request("/sessions/" + id)),
    upload: (...args) => context.uploads.upload(...args),
    fetch: environment.fetch,
    applyGenerated: (...args) => context.notes.applyGenerated(...args),
    generatedFallback: (...args) =>
      context.history.showGeneratedRecapFallback(...args),
    markdown: context.markdown.markdown,
    translate: environment.translate,
    updateSize: context.layout.updateSize,
    scroll: context.markdown.scroll,
  });
}
