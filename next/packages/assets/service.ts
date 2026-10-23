import { createHash } from "node:crypto";
import type { Asset, ObjectStore } from "./domain.ts";
import { AssetError } from "./domain.ts";
import { imageMime } from "./images.ts";
import type { AssetRepository } from "./repository.ts";

export const publicCapture = (asset: Asset) => ({
  id: asset.id,
  title: asset.title,
  time: asset.time,
  url: `/api/sessions/${asset.conversationId}/captures/${asset.id}`,
});
export function assets(dependencies: {
  repository: AssetRepository;
  objects: ObjectStore;
  identifier(): string;
  clock(): number;
  maximumBytes: number;
}) {
  const { repository, objects, clock, identifier, maximumBytes } = dependencies;
  return {
    async upload(
      workspaceId: string,
      conversationId: string,
      input: {
        data: Uint8Array;
        mime: string;
        title: string;
        time: string;
        requestKey: string;
      },
    ) {
      const mime = imageMime(input.data);
      if (input.mime !== mime) throw new AssetError("invalid_image");
      const receipt = await repository.legacyUpload(
        workspaceId,
        input.requestKey,
      );
      if (receipt) {
        const hash = createHash("sha256")
          .update(input.mime)
          .update("\0")
          .update(input.data)
          .digest("hex");
        if (receipt.conversationId !== conversationId || receipt.hash !== hash)
          throw new AssetError("request_conflict");
        const saved = await repository.find(
          workspaceId,
          conversationId,
          receipt.captureId,
        );
        if (!saved || saved.state !== "ready")
          throw new AssetError("asset_removed");
        return publicCapture(saved);
      }
      const id = identifier();
      const asset = await repository.stage(
        {
          id,
          workspaceId,
          conversationId,
          requestKey: input.requestKey,
          objectKey: `${workspaceId}/${id}`,
          mime,
          title: input.title,
          time: input.time,
          bytes: input.data.byteLength,
          hash: createHash("sha256").update(input.data).digest("hex"),
          createdAt: clock(),
          state: "staged",
        },
        maximumBytes,
      );
      if (asset.state !== "ready") {
        await objects.put(asset.objectKey, input.data, asset.mime);
        return publicCapture(await repository.complete(workspaceId, asset.id));
      }
      return publicCapture(asset);
    },
    async download(workspaceId: string, conversationId: string, id: string) {
      const asset = await repository.find(workspaceId, conversationId, id);
      if (!asset || asset.state !== "ready")
        throw new AssetError("asset_not_found");
      if (objects.download)
        return { url: await objects.download(asset.objectKey, 60) };
      const data = await objects.get(asset.objectKey, asset.bytes);
      if (createHash("sha256").update(data).digest("hex") !== asset.hash)
        throw Error("Private object checksum mismatch");
      return { data, mime: asset.mime };
    },
    remove: repository.remove.bind(repository),
    async reconcile() {
      const now = clock();
      const pending = await repository.garbage(now - 10 * 60_000, 50, now);
      for (const asset of pending) {
        await objects.remove(asset.objectKey);
        await repository.deleted(asset.id);
      }
      return pending.length;
    },
  };
}
export type AssetService = ReturnType<typeof assets>;
