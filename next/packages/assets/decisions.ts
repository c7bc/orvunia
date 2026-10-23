import type { Asset } from "./domain.ts";
import { AssetError } from "./domain.ts";

export function repeatedUpload(existing: Asset, incoming: Asset) {
  if (
    existing.conversationId !== incoming.conversationId ||
    existing.hash !== incoming.hash ||
    existing.mime !== incoming.mime ||
    existing.title !== incoming.title ||
    existing.time !== incoming.time ||
    existing.state === "deleting" ||
    existing.state === "deleted"
  )
    throw new AssetError("request_conflict");
  return existing;
}
export function assertUploadSession(session: { state: string } | undefined) {
  if (!session) throw new AssetError("conversation_not_found");
  if (session.state !== "active") throw new AssetError("conversation_ended");
}
