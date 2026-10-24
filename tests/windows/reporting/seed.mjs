import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadContext, physical } from "../context.mjs";
import { coreCommit } from "../config.mjs";
import { fixture } from "./fixture.mjs";
import { seedProfile } from "./profile.mjs";
const [statePath, sourcePath] = process.argv.slice(2);
const state = await loadContext(statePath), source = await physical(sourcePath);
assert.equal(execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), coreCommit);
try { await lstat(state.profile); throw Error("Reporting profile must be new"); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const module = name => import(pathToFileURL(join(source, "next/packages", name)).href);
const { prepareCandidateProfile } = await module("desktop/candidate-profile.ts");
const { sqliteConnection } = await module("storage/sqlite/connection.ts");
const { prepareDesktopStorage } = await module("migration/desktop.ts");
const { SqliteSessions } = await module("storage/sqlite/sessions.ts");
const identity = prepareCandidateProfile(state.profile);
await physical(state.profile);
await writeFile(join(state.profile, "desktop.json"), JSON.stringify({ autoListen: false,
  autoAnswer: false, systemAudio: false, transcribeMicrophone: false, autoScreen: false,
  ambientChat: false, launchAtLogin: false, uiLocale: "en" }), { flag: "wx" });
const selected = fixture(state.identity);
await seedProfile({ profile: state.profile, workspaceId: identity.workspaceId, selected,
  prepare: prepareDesktopStorage, connect: sqliteConnection, sessions: connection => new SqliteSessions(connection) });
await writeFile(join(state.root, "reporting-fixture.json"), JSON.stringify(selected), { flag: "wx" });
console.log("Synthetic offline reporting fixture prepared in the owned runner profile; no provider called.");
