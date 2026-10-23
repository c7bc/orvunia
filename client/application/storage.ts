import type { CommandAgenda } from "../commands/model.js";

export type ApplicationStorage = Pick<Storage, "getItem" | "setItem">;

function isAgenda(value: unknown): value is CommandAgenda[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry: unknown) =>
        !!entry &&
        typeof entry === "object" &&
        "id" in entry &&
        typeof entry.id === "string" &&
        "title" in entry &&
        typeof entry.title === "string" &&
        "date" in entry &&
        typeof entry.date === "string" &&
        "mode" in entry &&
        typeof entry.mode === "string",
    )
  );
}

export function readAgenda(
  storage: ApplicationStorage,
  key: string,
  legacy = false,
) {
  try {
    const raw =
      storage.getItem(key) ||
      (legacy ? storage.getItem("cadence-agenda") : null);
    const parsed: unknown = JSON.parse(raw || "[]");
    return isAgenda(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function selectedMode(storage: ApplicationStorage) {
  return storage.getItem("cadence-selected-mode") === "technical"
    ? "technical"
    : "recruiter";
}
