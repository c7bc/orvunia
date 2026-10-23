import { record, array, text, number } from "../legacy-web/validation.js";
import { applicationSession } from "./decoders.js";
import type { HistoryPage } from "../history/view.js";
import type { ExportNote } from "../application-export/contracts.js";
export function applicationIndex(value: unknown) {
  const item = record(value);
  if (item.before !== null && typeof item.before !== "string")
    throw Error("Cursor de sessões inválido.");
  return {
    ...item,
    items: array(item.items, applicationSession),
    before: item.before,
  };
}
export function applicationHistoryPage(value: unknown): HistoryPage {
  const item = record(value);
  if (item.before !== null && typeof item.before !== "string")
    throw Error("Cursor de histórico inválido.");
  return {
    ...item,
    generation: number(item.generation),
    total: number(item.total),
    before: item.before,
    items: array(item.items, (value) => {
      const item = record(value);
      return {
        ...item,
        id: text(item.id),
        ...(item._position === undefined
          ? {}
          : { _position: number(item._position) }),
      };
    }),
  };
}
export function applicationSavedNote(value: unknown) {
  const item = record(value);
  return { ...item, text: text(item.text), revision: number(item.revision) };
}
export function applicationAllNotes(value: unknown): { notes: ExportNote[] } {
  const item = record(value);
  return {
    ...item,
    notes: array(item.notes, (value) => {
      const item = record(value);
      if (
        item.updatedAt !== undefined &&
        item.updatedAt !== null &&
        typeof item.updatedAt !== "string"
      )
        throw Error("Data das notas inválida.");
      return {
        ...item,
        session: text(item.session),
        text: text(item.text),
        revision: number(item.revision),
        ...(item.updatedAt === undefined ? {} : { updatedAt: item.updatedAt }),
      };
    }),
  };
}
