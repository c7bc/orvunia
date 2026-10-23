import { escapeHtml } from "../design/html";
import { brandMark } from "../design/brand.js";
import { clamp } from "./geometry";
import type { GazeRuntime } from "./runtime";
export type Target = readonly [number, number];
export const calibrationTargets: readonly Target[] = [
  [0.5, 0.5],
  [0.12, 0.12],
  [0.5, 0.12],
  [0.88, 0.12],
  [0.88, 0.5],
  [0.88, 0.88],
  [0.5, 0.88],
  [0.12, 0.88],
  [0.12, 0.5],
];
export function calibrationOverlay(runtime: GazeRuntime, stop: () => void) {
  const { document, window, screen } = runtime.browser;
  let element: HTMLDivElement | null = null,
    ownsFullscreen = false;
  function remove() {
    const previous = element;
    element = null;
    if (ownsFullscreen && document.fullscreenElement === previous)
      void document.exitFullscreen().catch(() => {});
    ownsFullscreen = false;
    previous?.remove();
  }
  function draw(
    message = "Carregando modelo local…",
    target: Target = [0.5, 0.5],
  ) {
    if (!element) {
      element = document.createElement("div");
      element.className = "gaze-calibration";
      element.setAttribute("role", "dialog");
      element.setAttribute("aria-modal", "true");
      element.setAttribute("aria-label", "Calibração do olhar");
      document.body.append(element);
      element.addEventListener("click", (event) => {
        if ((event.target as Element | null)?.closest("[data-gaze-cancel]"))
          stop();
      });
    }
    element.innerHTML = `<header><span>${brandMark(20)} Orvunia <small>Calibração experimental</small></span><button data-gaze-cancel>Cancelar e desligar câmera</button></header><div class="gaze-instructions"><h2>Olhe para o ponto</h2><p>Mantenha a cabeça parada e acompanhe o ponto com os olhos.</p><strong role="status">${escapeHtml(message)}</strong></div><div class="gaze-target" style="left:${target[0] * 100}%;top:${target[1] * 100}%" aria-hidden="true"><span></span></div><footer>Processamento local · Nenhum vídeo é gravado ou enviado · Esc para cancelar</footer>`;
    runtime.options.onRendered?.(element);
  }
  function enter() {
    const requested = element;
    if (
      !requested ||
      document.fullscreenElement ||
      !requested.requestFullscreen
    )
      return;
    void requested
      .requestFullscreen()
      .then(() => {
        if (element !== requested) {
          if (document.fullscreenElement === requested)
            void document.exitFullscreen().catch(() => {});
          return;
        }
        ownsFullscreen = true;
      })
      .catch(() => {
        if (element === requested) ownsFullscreen = false;
      });
  }
  function onScreen(target: Target) {
    const border = Math.max(0, (window.outerWidth - window.innerWidth) / 2),
      top = Math.max(0, window.outerHeight - window.innerHeight - border);
    const left = Number.isFinite(screen.availLeft) ? screen.availLeft! : 0,
      screenTop = Number.isFinite(screen.availTop) ? screen.availTop! : 0,
      fullscreen = document.fullscreenElement === element;
    return {
      x: clamp(
        fullscreen
          ? target[0]
          : (window.screenX + border + target[0] * window.innerWidth - left) /
              screen.width,
      ),
      y: clamp(
        fullscreen
          ? target[1]
          : (window.screenY +
              top +
              target[1] * window.innerHeight -
              screenTop) /
              screen.height,
      ),
    };
  }
  return {
    draw,
    enter,
    remove,
    onScreen,
    active: () => element !== null,
    changed() {
      if (ownsFullscreen && element && document.fullscreenElement !== element)
        stop();
    },
  };
}
export type CalibrationOverlay = ReturnType<typeof calibrationOverlay>;
