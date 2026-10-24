import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadContext, physical } from "../context.mjs";
import { coreCommit } from "../config.mjs";
import { fixture } from "./fixture.mjs";
import { seedStore } from "./store.mjs";
const [statePath, sourcePath] = process.argv.slice(2);
const state = await loadContext(statePath), source = await physical(sourcePath);
assert.equal(execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), coreCommit);
try { await lstat(state.profile); throw Error("Reporting profile must be new"); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const module = name => import(pathToFileURL(join(source, "next/packages", name)).href);
const { prepareCandidateProfile } = await module("desktop/candidate-profile.ts");
const { sqliteConnection } = await module("storage/sqlite/connection.ts");
const { migrateSqlite } = await module("storage/migrations.ts");
const { SqliteSessions } = await module("storage/sqlite/sessions.ts");
const identity = prepareCandidateProfile(state.profile);
await physical(state.profile);
await writeFile(join(state.profile, "desktop.json"), JSON.stringify({ autoListen: false,
  autoAnswer: false, systemAudio: false, transcribeMicrophone: false, autoScreen: false,
  ambientChat: false, launchAtLogin: false, uiLocale: "en" }), { flag: "wx" });
await mkdir(join(state.profile, "data"));
const connection = sqliteConnection(join(state.profile, "data/cadence-next.sqlite"));
const selected = fixture(state.identity);
try {
  await migrateSqlite(connection);
  await seedStore(new SqliteSessions(connection), identity.workspaceId, selected);
} finally { connection.close(); }
await writeFile(join(state.root, "reporting-fixture.json"), JSON.stringify(selected), { flag: "wx" });
console.log("Synthetic offline reporting fixture prepared in the owned runner profile; no provider called.");
