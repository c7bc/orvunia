import { installAuxiliaryHost } from "./host.js";
import type { AuxiliaryTransport } from "./contracts.js";

const bridge = (window as unknown as { auxiliary?: AuxiliaryTransport }).auxiliary;
if (bridge) {
  const controller = installAuxiliaryHost(document, bridge);
  window.addEventListener("pagehide", () => controller.dispose(), { once: true });
}
