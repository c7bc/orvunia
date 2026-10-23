import { currentLocale } from "@cadence/i18n";
import type { NoteRequest } from "./contracts";
import { savedNote } from "./contracts";
export const requestNote: NoteRequest = async (id, method, body) => {
  const serialized = body ? JSON.stringify(body) : null;
  const response = await fetch(
    `/api/sessions/${encodeURIComponent(id)}/notes`,
    {
      method,
      credentials: "same-origin",
      keepalive:
        method === "PATCH" &&
        new TextEncoder().encode(serialized ?? "").byteLength <= 60000,
      headers: {
        "X-Cadence-Request": "1",
        "Accept-Language": currentLocale(),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(serialized ? { body: serialized } : {}),
    },
  );
  const data: unknown = await response.json();
  if (!response.ok) {
    const error =
      data && typeof data === "object" && "error" in data ? data.error : null;
    throw Object.assign(
      new Error(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Não foi possível salvar suas notas.",
      ),
      {
        code:
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "",
        current:
          data && typeof data === "object" && "current" in data
            ? savedNote(data.current)
            : null,
      },
    );
  }
  const value = savedNote(data);
  if (!value) throw Error("Resposta de notas inválida.");
  return value;
};
