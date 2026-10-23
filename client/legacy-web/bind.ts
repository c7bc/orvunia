import { createSettingsActions } from "./actions-settings.js";
import { createSessionActions } from "./actions-session.js";
import { bindWorkspaceClick } from "./bind-click.js";
import { bindWorkspaceChange } from "./bind-change.js";
import { bindWorkspaceKeydown } from "./bind-keydown.js";
import { bindWorkspaceComposer } from "./bind-composer.js";
import { bindWorkspaceDialog } from "./bind-dialog.js";
import { bindWorkspaceDragStart } from "./bind-drag-start.js";
import { bindWorkspaceDragMove } from "./bind-drag-move.js";
import { bindWorkspaceDragEnd } from "./bind-drag-end.js";
import { bindWorkspaceTimer } from "./bind-timer.js";
import type { WorkspaceContext } from "./workspace-types.js";
import type { WorkspaceEvents } from "./events.js";
export function bindCompatibilityWorkspace(
  context: WorkspaceContext,
  events: WorkspaceEvents,
) {
  const actions = {
    ...createSettingsActions(context),
    ...createSessionActions(context),
  };
  for (const bind of [
    bindWorkspaceClick,
    bindWorkspaceChange,
    bindWorkspaceKeydown,
    bindWorkspaceComposer,
    bindWorkspaceDialog,
    bindWorkspaceDragStart,
    bindWorkspaceDragMove,
    bindWorkspaceDragEnd,
    bindWorkspaceTimer,
  ])
    bind(context, events, actions);
}
