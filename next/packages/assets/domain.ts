export interface ObjectStore {
  put(key: string, data: Uint8Array, mime: string): Promise<void>;
  get(
    key: string,
    maximumBytes: number,
    signal?: AbortSignal,
  ): Promise<Uint8Array>;
  remove(key: string, signal?: AbortSignal): Promise<void>;
  download?(key: string, seconds: number): Promise<string>;
}
export type Asset = {
  id: string;
  workspaceId: string;
  conversationId: string;
  requestKey: string;
  objectKey: string;
  hash: string;
  bytes: number;
  mime: string;
  title: string;
  time: string;
  state: "staged" | "ready" | "deleting" | "deleted";
  createdAt: number;
};
export type LegacyUpload = {
  conversationId: string;
  captureId: string;
  hash: string;
};
export class AssetError extends Error {
  constructor(
    readonly code:
      | "invalid_image"
      | "asset_limit"
      | "asset_not_found"
      | "asset_removed"
      | "request_conflict"
      | "conversation_not_found"
      | "conversation_ended",
  ) {
    super(code);
  }
}
