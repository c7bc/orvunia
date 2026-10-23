import type { OverlayStatePorts } from "./state-types.js";

export function createOverlayState(ports: OverlayStatePorts) {
  return () => {
    const state = ports.read();
    return {
      ...state,
      coding: state.current ? ports.coding(state.current.id) : null,
    };
  };
}
