import { createCompatibilityController } from "./workspace.js";
import { createWorkspaceEvents } from "./events.js";
import { createCompatibilityData } from "./data.js";
import { createCompatibilityState } from "./local.js";
import { createWorkspacePorts } from "./platform.js";
import { bindCompatibilityWorkspace } from "./bind.js";
import type {
  CompatibilityApplication,
  CompatibilityPlatform,
} from "./platform-types.js";
import type { BrowserPorts } from "./contracts.js";
export function createCompatibilityApplication(
  platform: CompatibilityPlatform,
): CompatibilityApplication {
  const state = createCompatibilityState(platform.window.localStorage),
    data = createCompatibilityData();
  const ports = createWorkspacePorts(platform, data, () => controller);
  const controller = createCompatibilityController(state, ports),
    events = createWorkspaceEvents(platform.window);
  let mounted = false,
    disposed = false,
    audio: BrowserPorts["audio"] | undefined;
  function dispose() {
    if (disposed) return;
    disposed = true;
    events.dispose();
    platform.window.clearTimeout(state.toastTimeout);
    state.drag = null;
    controller.cancelGeneration();
    platform.window.removeEventListener("pagehide", dispose);
    void audio?.stop().catch((error) => platform.live().reportError(error));
  }
  return {
    state,
    controller,
    connect(source) {
      if (disposed) throw Error("A janela já foi encerrada.");
      audio = source;
      return { state, ports: { ...ports, audio: source } };
    },
    mount() {
      if (mounted || disposed) return;
      mounted = true;
      bindCompatibilityWorkspace(
        { state, ports, workspace: controller },
        events,
      );
      platform.window.addEventListener("pagehide", dispose);
      controller.decorate();
      controller.renderProfile();
      controller.renderMode();
    },
    dispose,
  };
}
