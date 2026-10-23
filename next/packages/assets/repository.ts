import type { Asset, LegacyUpload } from "./domain.ts";

export interface AssetRepository {
  legacyUpload(
    workspaceId: string,
    requestKey: string,
  ): Promise<LegacyUpload | null>;
  stage(asset: Asset, maximumBytes: number): Promise<Asset>;
  complete(workspaceId: string, id: string): Promise<Asset>;
  find(
    workspaceId: string,
    conversationId: string,
    id: string,
  ): Promise<Asset | null>;
  remove(
    workspaceId: string,
    conversationId: string,
    id: string,
  ): Promise<void>;
  garbage(stagedBefore: number, limit: number, now: number): Promise<Asset[]>;
  deleted(id: string): Promise<void>;
}
