import { runPracticeTests } from "./practice.js";
import type {
  WorkspaceContext,
  WorkspaceController,
  WorkspacePorts,
  WorkspaceState,
} from "./workspace-types.js";
import { createWorkspaceLayout } from "./workspace-layout.js";
import { createWorkspaceInput } from "./workspace-input.js";
import { createWorkspaceRecruiter } from "./workspace-recruiter.js";
import { createWorkspaceTechnical } from "./workspace-technical.js";
import { createWorkspaceModal } from "./workspace-modal.js";
import { createWorkspaceLifecycle } from "./workspace-lifecycle.js";
import { createWorkspaceClipboard } from "./workspace-clipboard.js";
export function createCompatibilityController(
  state: WorkspaceState,
  ports: WorkspacePorts,
): WorkspaceController {
  const workspace = {} as WorkspaceController;
  const context: WorkspaceContext = { state, ports, workspace };
  return Object.assign(workspace, {
    ...createWorkspaceLayout(context),
    ...createWorkspaceInput(context),
    ...createWorkspaceRecruiter(context),
    ...createWorkspaceTechnical(context),
    ...createWorkspaceModal(context),
    ...createWorkspaceLifecycle(context),
    ...createWorkspaceClipboard(context),
    runTests() {
      state.testResults = runPracticeTests(
        ports.problems[state.currentProblem]!,
        state.currentProblem,
      );
      state.testsRun = true;
      workspace.renderAnswer();
    },
  });
}
