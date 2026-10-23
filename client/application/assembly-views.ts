import type { ApplicationContext } from "./context.js";
import { createApplicationCoding } from "./coding.js";
import { createApplicationMarkdown } from "./markdown.js";
import { createApplicationLayout } from "./layout.js";
import { createApplicationModal } from "./modal.js";

export function assembleMarkdown(context: ApplicationContext) {
  return createApplicationMarkdown({
    state: context.state,
    document: context.environment.document,
    platform: context.environment.markdown,
    history: context.historyDom,
    reviewHistory: context.reviewHistoryDom,
    toast: (message) => context.modal.toast(message),
    translate: context.environment.translate,
  });
}
export function assembleCoding(context: ApplicationContext) {
  const { state, environment, presentation } = context;
  return createApplicationCoding({
    state,
    document: environment.document,
    escape: presentation.escape,
    escapeSelector: environment.escapeSelector,
    translate: environment.translate,
    locale: environment.locale,
    markdown: (text) => context.markdown.markdown(text),
    modal: (...args) => context.modal.modal(...args),
    toast: (message) => context.modal.toast(message),
    updateSize: () => context.layout.updateSize(),
    scroll: () => context.markdown.scroll(),
    decorate: () => context.markdown.decorate(),
    request: context.request,
    render: () => context.rendering.render(),
    sync: () => context.synchronization.sync(),
    reducedMotion: () =>
      environment.window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
}
export function assembleLayout(context: ApplicationContext) {
  return createApplicationLayout({
    state: context.state,
    document: context.environment.document,
    window: context.environment.window,
    native: context.native,
    hasAttempt: (id) => Boolean(context.coding.coding.get(id).attempt),
    cancelPrepared: () => context.coding.prepared.cancel(),
    toast: (message) => context.modal.toast(message),
  });
}
export function assembleModal(context: ApplicationContext) {
  return createApplicationModal({
    state: context.state,
    document: context.environment.document,
    window: context.environment.window,
    animate: context.layout.animate,
    updateSize: context.layout.updateSize,
    cancelCrop: () => context.captures.crop.cancel(),
    disposeFollowup: () => context.followup.dispose(),
    cancelPrepared: () => context.coding.prepared.cancel(),
    cancelSearch: () => context.commandSearch.cancel(),
    render: () => context.rendering.render(),
    iconButton: context.presentation.iconButton,
    translate: context.environment.translate,
  });
}
