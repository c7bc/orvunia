import { commandSession } from "../commands/boundary.js";
import type { HistoryWindow } from "../history/view.js";
import { record, number } from "../legacy-web/validation.js";

function window(value: unknown): HistoryWindow {
  const item = record(value);
  if (item.before !== null && typeof item.before !== "string")
    throw Error("Cursor de histórico inválido.");
  if (item.expanded !== undefined && typeof item.expanded !== "boolean")
    throw Error("Janela de histórico inválida.");
  return {
    ...item,
    total: number(item.total),
    before: item.before,
    ...(item.generation === undefined
      ? {}
      : { generation: number(item.generation) }),
    ...(item.expanded === undefined ? {} : { expanded: item.expanded }),
  };
}
export function applicationSession(value: unknown) {
  const session = commandSession(value),
    input = record(value);
  if (input.history === undefined) return session;
  const history = record(input.history);
  return {
    ...session,
    history: {
      ...history,
      generation: number(history.generation),
      responses: window(history.responses),
      transcripts: window(history.transcripts),
      captures: window(history.captures),
    },
  };
}
