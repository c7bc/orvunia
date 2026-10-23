import { mkdir, open } from "node:fs/promises";
import { resolve, join } from "node:path";
import { legacyReader } from "./reader.ts";
import { projectLegacy } from "./project.ts";
import type { ImportManifest, LegacyProjection } from "./projection.ts";

export async function prepareLegacyImport(source: string, directory: string) {
  const root = resolve(directory);
  await mkdir(root, { mode: 0o700 });
  const reader = await legacyReader(source);
  try {
    const runId = crypto.randomUUID(),
      now = new Date().toISOString();
    const projection = projectLegacy(reader, runId, now);
    await reader.archive(join(root, "legacy.snapshot.sqlite"));
    const manifest: ImportManifest = {
      format: "cadence-migration-staging/1",
      runId,
      sourceHash: reader.hash,
      createdAt: now,
      counts: {
        workspaces: projection.workspaces.length,
        sessions: projection.sessions.length,
        entries: projection.entries.length,
        images: projection.images.length,
        notes: projection.notes.length,
      },
      unhandled: projection.unhandled,
      supplemental: {
        drafts: projection.supplemental.drafts.length,
        deliveries: projection.supplemental.deliveries.length,
        reservations: projection.supplemental.reservations.length,
      },
      receipts: {
        uploads: projection.receipts.uploads.length,
        segments: projection.receipts.segments.length,
      },
      billing: {
        accounts: projection.billing.accounts.length,
        events: projection.billing.events.length,
        reconciliation: projection.billing.reconciliation.length,
      },
      cutoverAllowed: false,
    };
    return { projection, manifest, root };
  } finally {
    reader.close();
  }
}
export async function recordImport(
  directory: string,
  manifest: ImportManifest,
  filename:
    "import-manifest.json" | "import-pending.json" = "import-manifest.json",
) {
  const handle = await open(join(directory, filename), "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(manifest, null, 2));
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export type ImportProjection = LegacyProjection;
