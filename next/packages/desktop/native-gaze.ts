import { gazeRequest, smoothGaze } from "./gaze-geometry.ts";
import type { GazePorts, GazeTracking } from "./gaze-types.ts";
export function createNativeGaze(ports: GazePorts) {
  const tracking: GazeTracking = {
    enabled: false,
    previous: null,
    lastMove: null,
    sender: null,
  };
  function stop() {
    if (!tracking.enabled) return;
    const previous = tracking.previous;
    Object.assign(tracking, {
      enabled: false,
      previous: null,
      lastMove: null,
      sender: null,
    });
    const window = ports.window();
    if (previous && window && !window.isDestroyed()) {
      const restored = ports.clamp({
        ...window.getBounds(),
        x: previous.x,
        y: previous.y,
      });
      window.setPosition(restored.x, restored.y);
      ports.align();
      ports.restored();
    }
    ports.changed();
  }
  function move(sender: number, raw: unknown) {
    const value = gazeRequest(raw);
    if (value.enabled === false) {
      stop();
      return { enabled: false, moved: false };
    }
    if (tracking.enabled && tracking.sender !== sender)
      throw Error("O acompanhamento do olhar está ativo em outra janela.");
    const window = ports.window();
    if (!window || window.isDestroyed())
      throw Error("A janela do assistente não está disponível.");
    if (value.enabled === true && !tracking.enabled) {
      tracking.previous = window.getBounds();
      tracking.enabled = true;
      tracking.sender = sender;
      tracking.lastMove = null;
      ports.changed();
    }
    if (!tracking.enabled)
      throw Error("Ative o acompanhamento do olhar antes de mover a janela.");
    if (!value.point) return { enabled: true, moved: false };
    const now = ports.clock();
    if (tracking.lastMove !== null && now - tracking.lastMove < 100)
      return { enabled: true, moved: false, rateLimited: true };
    tracking.lastMove = now;
    const bounds = window.getBounds(),
      next = smoothGaze(bounds, ports.area(bounds), value.point);
    if (Math.hypot(next.x - bounds.x, next.y - bounds.y) < 8)
      return { enabled: true, moved: false };
    window.setPosition(next.x, next.y);
    ports.align();
    return { enabled: true, moved: true };
  }
  return {
    stop,
    move,
    status: () => ({
      ...tracking,
      previous: tracking.previous ? { ...tracking.previous } : null,
    }),
  };
}
