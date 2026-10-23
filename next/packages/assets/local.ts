import { dirname, join } from "node:path";
import type { LocalSettings } from "../config/local.ts";
import { filesystemObjects } from "./filesystem.ts";
import { assets } from "./service.ts";
import type { AssetRepository } from "./repository.ts";

export async function localAssets(settings: LocalSettings, repository: AssetRepository) {
  const objects = await filesystemObjects(settings.CADENCE_OBJECT_DIRECTORY ??
    join(dirname(settings.CADENCE_SQLITE_PATH), "objects"));
  return {
    objects,
    service: assets({ repository, objects, identifier: () => Bun.randomUUIDv7(),
      clock: Date.now, maximumBytes: settings.CADENCE_ASSET_QUOTA_BYTES }),
    close() {},
  };
}
