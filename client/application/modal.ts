import type { ApplicationState } from "./model.js";
import type { SurfaceAnimator } from "../overlay/animation.js";
import { createModalSurface } from "../overlay/modal.js";
import { popupVisualState } from "../motion/index.js";

export function createApplicationModal(ports: {
  state: ApplicationState;
  document: Document;
  window: Window;
  animate: SurfaceAnimator;
  updateSize(): void;
  cancelCrop(): void;
  disposeFollowup(): void;
  cancelPrepared(): void;
  cancelSearch(): void;
  render(): void;
  iconButton(name: string, action: string, title: string): string;
  translate(message: string): string;
}) {
  const { state, document, window } = ports;
  let toastTimer: number | null = null;
  const surface = createModalSurface({
    document,
    animate: ports.animate,
    updateSize: ports.updateSize,
    visual: popupVisualState,
    media: window.matchMedia("(prefers-reduced-motion: reduce)"),
  });
  function modal(title: string, content: string, className = "") {
    ports.cancelCrop();
    if (state.reviewChatSessionId && className !== "session-review-chat") {
      state.reviewChatSessionId = null;
      ports.render();
    }
    state.microphoneTest?.dispose();
    state.microphoneTest = null;
    if (state.view === "overlay") {
      state.auxiliaryModal = true;
      ports.updateSize();
    }
    state.draft =
      document.querySelector<HTMLTextAreaElement>("#question")?.value ??
      state.draft;
    surface.open(
      title,
      content,
      className,
      ports.iconButton("close", "modal-close", "Fechar"),
    );
  }
  function close() {
    ports.cancelCrop();
    ports.disposeFollowup();
    ports.cancelPrepared();
    ports.cancelSearch();
    const review = state.reviewChatSessionId !== null;
    state.reviewChatSessionId = null;
    state.microphoneTest?.dispose();
    state.microphoneTest = null;
    state.auxiliaryModal = false;
    surface.close();
    if (review) ports.render();
  }
  function toast(message: string) {
    const element = document.querySelector<HTMLElement>("#toast");
    if (!element) return;
    element.textContent = ports.translate(message);
    element.classList.add("visible");
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => element.classList.remove("visible"),
      4500,
    );
  }
  return {
    modal,
    close,
    toast,
    surface,
    dispose() {
      if (toastTimer !== null) window.clearTimeout(toastTimer);
      surface.dispose();
    },
  };
}
