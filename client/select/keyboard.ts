import type {
  SelectActions,
  SelectContext,
  SelectRecord,
} from "./contracts.js";
import { validIndexes } from "./options.js";
const navigation = [
  "ArrowDown",
  "ArrowUp",
  "Home",
  "End",
  "Enter",
  " ",
  "Escape",
  "Tab",
];
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
export function selectKeyboard(
  context: SelectContext,
  record: SelectRecord,
  actions: SelectActions,
) {
  return (event: KeyboardEvent) => {
    if (navigation.includes(event.key)) {
      if (event.key === "Tab") {
        if (context.current?.record === record) actions.close();
        return;
      }
      if (event.key === "Escape") {
        if (context.current?.record === record) {
          event.preventDefault();
          event.stopPropagation();
          actions.close({ focus: true });
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter" || event.key === " ") {
        if (context.current?.record === record)
          actions.choose(context.current.index);
        else actions.open(record);
        return;
      }
      const wasOpen = context.current?.record === record;
      if (!wasOpen) actions.open(record);
      if (!context.current) return;
      const enabled = validIndexes(record);
      if (!enabled.length) return;
      let index = enabled.indexOf(context.current.index);
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = enabled.length - 1;
      else if (wasOpen)
        index =
          (index + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) %
          enabled.length;
      const selected = enabled[Math.max(0, index)];
      if (selected !== undefined) actions.highlight(selected);
      return;
    }
    if (
      event.key.length !== 1 ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    record.buffer = now - record.bufferAt > 700 ? "" : record.buffer;
    record.bufferAt = now;
    record.buffer += event.key.toLocaleLowerCase();
    if (context.current?.record !== record) actions.open(record);
    if (!context.current) return;
    const enabled = validIndexes(record);
    const start = enabled.indexOf(context.current.index);
    const ordered = enabled.map(
      (_, offset) => enabled[(start + 1 + offset) % enabled.length]!,
    );
    const matches = (index: number) =>
      normalized(record.select.options[index]!.label).startsWith(
        normalized(record.buffer),
      );
    let match = ordered.find(matches);
    if (match === undefined && record.buffer.length > 1) {
      record.buffer = event.key.toLocaleLowerCase();
      match = enabled.find(matches);
    }
    if (match !== undefined) actions.highlight(match);
  };
}
