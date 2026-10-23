import type { ApplicationState } from "../application/model.js";
import type { ApplicationStorage } from "../application/storage.js";
export function saveApplicationAgenda(ports: {
  state: ApplicationState;
  storage: ApplicationStorage;
  reminders(agenda: ApplicationState["agenda"]): unknown;
}) {
  ports.storage.setItem(
    ports.state.workspaceKey,
    JSON.stringify(ports.state.agenda),
  );
  ports.reminders(ports.state.agenda);
}
