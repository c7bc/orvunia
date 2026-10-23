import { record, text } from "../legacy-web/validation.js";
type UpdateResult = {
  status: "not-configured" | "unavailable" | "current" | "available";
  release?: { version: string; notes: string; sha256: string; url: string };
};
export function updateResult(value: unknown): UpdateResult {
  const item = record(value),
    status = item.status;
  if (
    status !== "not-configured" &&
    status !== "unavailable" &&
    status !== "current" &&
    status !== "available"
  )
    throw Error("Resposta inválida de atualização.");
  if (item.release === undefined) return { status };
  const release = record(item.release);
  return {
    status,
    release: {
      version: text(release.version),
      notes: text(release.notes),
      sha256: text(release.sha256),
      url: text(release.url),
    },
  };
}
