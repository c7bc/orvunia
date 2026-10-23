import { createHash } from "node:crypto";
import { basename } from "node:path";
import { z } from "zod";
import { readPrivateFile } from "../providers/private-file.ts";
import type { Repository, Configuration } from "./domain.ts";
import { ConnectionError } from "./domain.ts";
import { atomicWrite, missingFile } from "./atomic.ts";
import { configuration } from "./contracts.ts";
const journalSchema = z.object({ schemaVersion: z.literal(1),
  state: z.enum(["preparing", "config-written", "active"]),
  destination: z.string().min(1).max(160), contentHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
const digest = (value: Configuration) => createHash("sha256").update(JSON.stringify(configuration.parse(value))).digest("hex");
export async function promoteConfiguration(options: {
  repository: Repository; filename: string; journal: string;
  initial(): Promise<Configuration>;
  checkpoint?(state: "preparing" | "config-written" | "active"): Promise<void>;
}) {
  return options.repository.transaction(async () => {
    let journal: z.infer<typeof journalSchema> | null = null;
    try { journal = journalSchema.parse(JSON.parse((await readPrivateFile(options.journal, 2048)).toString("utf8"))); }
    catch (error) { if (!missingFile(error)) throw new ConnectionError("connection_settings_unreadable", 503); }
    if (journal && journal.destination !== basename(options.filename)) throw new ConnectionError("connection_settings_unreadable", 503);
    const existing = await options.repository.read();
    if (existing) {
      if (journal && journal.state !== "active" && journal.contentHash !== digest(existing))
        throw new ConnectionError("connection_settings_unreadable", 503);
      if (journal?.state !== "active") await save("active", existing);
      return existing;
    }
    if (journal?.state === "active" || journal?.state === "config-written")
      throw new ConnectionError("connection_settings_unreadable", 503);
    const initial = await options.initial();
    if (journal && journal.contentHash !== digest(initial)) throw new ConnectionError("connection_settings_unreadable", 503);
    await save("preparing", initial);
    await options.repository.write(initial);
    const verified = await options.repository.read();
    if (!verified || digest(verified) !== digest(initial)) throw new ConnectionError("connection_settings_unreadable", 503);
    await save("config-written", verified);
    await save("active", verified);
    return verified;
    async function save(state: "preparing" | "config-written" | "active", value: Configuration) {
      await atomicWrite(options.journal, JSON.stringify({ schemaVersion: 1, state,
        destination: basename(options.filename), contentHash: digest(value) }));
      await options.checkpoint?.(state);
    }
  });
}
