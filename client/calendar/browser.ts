import { record } from "./boundary";
import type { CalendarApi } from "./contracts";
export const browserCalendarRequest: CalendarApi = async (
  path,
  method = "GET",
  body,
) => {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      "X-Cadence-Request": "1",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const data = record(value),
      error =
        data.error && typeof data.error === "object" ? record(data.error) : {};
    throw Error(
      typeof error.message === "string"
        ? error.message
        : typeof data.message === "string"
          ? data.message
          : "Não foi possível atualizar a agenda.",
    );
  }
  return value;
};
