import { z } from "zod";
import { SessionError } from "./domain.ts";
import type { HistoryKind, SessionRecord } from "./domain.ts";

const schema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["transcripts", "responses", "captures"]),
    position: z.number().int().positive().safe(),
    generation: z.number().int().nonnegative().safe(),
  })
  .strict();
export function historyPosition(
  token: string | undefined,
  session: SessionRecord,
  kind: HistoryKind,
) {
  if (!token) return undefined;
  let cursor: z.infer<typeof schema>;
  try {
    if (token.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(token))
      throw Error("Invalid cursor");
    cursor = schema.parse(
      JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
    );
  } catch {
    throw new SessionError("invalid_input");
  }
  if (
    cursor.id !== session.id ||
    cursor.kind !== kind ||
    cursor.generation !== session.historyGeneration
  )
    throw new SessionError("history_changed");
  return cursor.position;
}
export const historyCursor = (
  session: SessionRecord,
  kind: HistoryKind,
  position: number,
) =>
  Buffer.from(
    JSON.stringify({
      id: session.id,
      kind,
      position,
      generation: session.historyGeneration,
    }),
  ).toString("base64url");
