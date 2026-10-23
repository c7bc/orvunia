import type { LifecycleSession, LifecyclePorts } from "./lifecycle-types.js";
import { lifecycleScope } from "./lifecycle-scope.js";
import { lifecycleSelection } from "./lifecycle-selection.js";
import { lifecycleMutations } from "./lifecycle-mutations.js";
export function createSessionLifecycle<Session extends LifecycleSession>(
  ports: LifecyclePorts<Session>,
) {
  const scope = lifecycleScope(ports.workspace),
    selection = lifecycleSelection(ports, scope),
    mutations = lifecycleMutations(ports, scope);
  function reset() {
    scope.reset();
    selection.reset();
    mutations.reset();
  }
  return {
    begin: selection.begin,
    activate: selection.activate,
    pause: mutations.pause,
    end: mutations.end,
    reset,
    dispose() {
      reset();
      scope.dispose();
    },
  };
}
