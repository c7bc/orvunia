import { type WorkspaceContext } from "./workspace-types.js";

import type { WorkspaceEvents } from "./events.js";
import type { WorkspaceActions } from "./workspace-types.js";
export function bindWorkspaceTimer(
  { state: browser, ports, workspace }: WorkspaceContext,
  events: WorkspaceEvents,
  actions: WorkspaceActions,
) {
  events.interval(() => {
    if (browser.liveReady) return ports.live().tick();
    if (!browser.session.active || browser.session.paused) return;
    browser.session.elapsed++;
    workspace.renderSession();
    if (browser.session.elapsed % 12 === 0) {
      const extra =
        ports.data.extraTranscripts[browser.mode][
          browser.session.extraIndex % 3
        ]!;
      browser.session.extraIndex++;
      const parts = browser.transcripts[browser.mode]
        .at(-1)!
        .time.split(":")
        .map(Number);
      browser.transcripts[browser.mode].push({
        ...extra,
        time: ports.formatTime(parts[0]! * 60 + parts[1]! + 12),
      });
      workspace.renderInput();
      ports.element("#transcript-view").scrollTop =
        ports.element("#transcript-view").scrollHeight;
    }
  }, 1000);
}
