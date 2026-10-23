import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { emptyWorkspace } from "../../packages/workspaces/defaults.ts";
import type { Workspace } from "../../packages/workspaces/domain.ts";
import type { WorkspaceRepository } from "../../packages/workspaces/repository.ts";
import { workspaces } from "../../packages/workspaces/service.ts";
import { modes } from "../../packages/workspaces/modes.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { defaultModeInstructions } from "../../packages/workspaces/templates.ts";
import { globalSystemPrompt } from "../../packages/prompts/global.ts";
import { defaultRoleInstructions } from "../../packages/prompts/mode-instructions.ts";

const now = "2026-10-20T00:00:00.000Z";
const clock = () => new Date(now);
function legacy(id = crypto.randomUUID()): Workspace {
  const value = emptyWorkspace(id, now);
  delete value.systemPromptVersion;
  for (const mode of value.modes) { mode.instructions = ""; delete mode.systemPrompt; }
  return value;
}
function memory(initial: Workspace | null) {
  let stored = initial ? structuredClone(initial) : null;
  const repository: WorkspaceRepository = {
    find: async () => stored ? structuredClone(stored) : null,
    insert: async value => { if (stored) return false; stored = structuredClone(value); return true; },
    replace: async (value, revision) => {
      if (stored?.revision !== revision) return false;
      stored = structuredClone(value); return true;
    },
  };
  return { repository, saved: () => structuredClone(stored) };
}

test("new workspace insertion races persist full visible builtin prompts exactly once", async () => {
  const fixture = memory(null), service = workspaces(fixture.repository, clock), id = crypto.randomUUID();
  const results = await Promise.all(Array.from({ length: 4 }, () => service.find(id)));
  expect(results.every(value => value.revision === 0 && value.systemPromptVersion === 3)).toBe(true);
  expect(fixture.saved()?.modes).toHaveLength(2);
  for (const mode of results[0]?.modes ?? []) {
    expect(mode.systemPrompt).toBe(globalSystemPrompt("en")); expect(mode.instructions).toBe(defaultRoleInstructions(mode.base));
  }
});

test("real SQLite migration retains custom text, repairs missing builtin and never rewrites frozen session data", async () => {
  const connection = sqliteConnection(":memory:");
  try {
    await migrateSqlite(connection);
    const repository = new SqliteWorkspaces(connection), before = legacy();
    const customId = crypto.randomUUID(), document = { id: crypto.randomUUID(), name: "Reference", text: "Synthetic source", date: now };
    before.modes = before.modes.filter(mode => mode.id !== "recruiter");
    const technical = before.modes[0];
    if (!technical) throw Error("Missing fixture mode");
    technical.instructions = "Texto autoral sem alteração.  ";
    before.preferences.instructions = "  Estilo global integral.  ";
    before.preferences.modeInstructions.technical = technical.instructions;
    before.preferences.noteTemplates.technical = "Notas separadas";
    before.modes.push({ ...technical, id: customId, name: "Autoral", builtin: false,
      sections: [{ title: "Seção", instructions: "Notas" }], documents: [document] });
    before.activeId = customId;
    before.library.documents = [document];
    await repository.insert(before);
    const snapshot = JSON.stringify({ instructions: "Snapshot original imutável", documents: [document] });
    connection.client.query("INSERT INTO next_conversations(id,workspace_id,title,mode,state,created_at,mode_snapshot) VALUES(?,?,?,?,?,?,?)")
      .run("frozen", before.id, "Synthetic", "technical", "ended", now, snapshot);
    connection.client.query("INSERT INTO next_history(id,conversation_id,kind,data) VALUES(?,?,?,?)")
      .run("frozen-answer", "frozen", "responses", JSON.stringify({ text: "Historical answer" }));
    connection.client.query(`INSERT INTO next_operations(id,kind,workspace_id,conversation_id,request_hash,state,
      attempt,snapshot,snapshot_bytes,lease,lease_until,expires_at,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run("frozen-operation", "answer", before.id, "frozen", "hash",
        "failed", 1, snapshot, Buffer.byteLength(snapshot), "lease", 0, 1, 0);
    const history = connection.client.query("SELECT * FROM next_history").all();
    const operations = connection.client.query("SELECT * FROM next_operations").all();
    const service = workspaces(repository, clock), migrated = await service.find(before.id);
    expect(migrated.systemPromptVersion).toBe(3);
    expect(migrated.revision).toBe(1);
    expect(migrated.modes).toHaveLength(3);
    expect(migrated.activeId).toBe(customId);
    expect(migrated.library).toEqual(before.library);
    expect(migrated.preferences.noteTemplates).toEqual(before.preferences.noteTemplates);
    expect(migrated.preferences.instructions).toBe("");
    expect(migrated.preferences.modeInstructions).toEqual({ recruiter: "", technical: "" });
    const custom = migrated.modes.find(mode => mode.id === customId);
    expect(custom?.documents).toEqual([document]);
    expect(custom?.sections).toEqual(before.modes[1]?.sections);
    expect(custom?.instructions.split(technical.instructions)).toHaveLength(2);
    expect(custom?.instructions).toContain(before.preferences.instructions);
    expect(custom?.systemPrompt).toBe(globalSystemPrompt("en"));
    expect(connection.client.query<{ mode_snapshot: string }, []>("SELECT mode_snapshot FROM next_conversations WHERE id='frozen'").get()?.mode_snapshot).toBe(snapshot);
    expect(connection.client.query("SELECT * FROM next_history").all()).toEqual(history);
    expect(connection.client.query("SELECT * FROM next_operations").all()).toEqual(operations);
    expect(await service.find(before.id)).toEqual(migrated);
    expect(await repository.find(before.id)).toEqual(migrated);
  } finally { connection.close(); }
});

test("explicitly erased prompts survive database reopen without hidden defaults returning", async () => {
  const filename = resolve(import.meta.dirname, "../../../work/workspace-prompt-tests", crypto.randomUUID() + ".sqlite");
  let connection = sqliteConnection(filename);
  const id = crypto.randomUUID();
  try {
    await migrateSqlite(connection);
    const repository = new SqliteWorkspaces(connection);
    await repository.insert(legacy(id));
    const service = workspaces(repository, clock);
    await service.find(id);
    await modes(service, () => crypto.randomUUID(), clock).edit(id, "technical", { systemPrompt: "", instructions: "" });
    const revision = (await service.find(id)).revision;
    connection.close();
    connection = sqliteConnection(filename);
    const restarted = workspaces(new SqliteWorkspaces(connection), clock);
    const saved = await restarted.find(id);
    expect(saved.systemPromptVersion).toBe(3);
    expect(saved.revision).toBe(revision);
    expect(saved.modes.find(mode => mode.id === "technical")?.instructions).toBe("");
    expect(saved.modes.find(mode => mode.id === "technical")?.systemPrompt).toBe("");
  } finally { connection.close(); }
});

test("migration retries CAS using the concurrent author's latest text instead of overwriting it", async () => {
  const before = legacy(), fixture = memory(before);
  const replace = fixture.repository.replace;
  let collisions = 0;
  fixture.repository.replace = async (value, revision) => {
    if (collisions++ === 0) {
      const concurrent = await fixture.repository.find(before.id);
      if (!concurrent || !concurrent.modes[0]) throw Error("Missing fixture workspace");
      concurrent.modes[0].instructions = "Edição simultânea preservada";
      concurrent.revision++;
      await replace(concurrent, revision);
      return false;
    }
    return replace(value, revision);
  };
  const migrated = await workspaces(fixture.repository, clock).find(before.id);
  expect(migrated.revision).toBe(2);
  expect(migrated.modes[0]?.instructions).toContain("Edição simultânea preservada");
  expect(migrated.modes[0]?.systemPrompt).toBe(globalSystemPrompt("en"));
});

test("uncommitted migrations fail closed and do not leak a synthetic successful read", async () => {
  const before = legacy(), fixture = memory(before);
  let attempts = 0;
  fixture.repository.replace = async () => { attempts++; return false; };
  await expect(workspaces(fixture.repository, clock).find(before.id)).rejects.toMatchObject({ code: "workspace_conflict" });
  expect(attempts).toBe(8);
  expect(fixture.saved()).toEqual(before);
});

test("already marked workspaces only repair missing builtins and preserve intentionally empty existing prompts", async () => {
  const before = emptyWorkspace(crypto.randomUUID(), now);
  before.modes = before.modes.filter(mode => mode.id === "technical");
  if (!before.modes[0]) throw Error("Missing fixture mode");
  before.modes[0].instructions = "";
  before.modes[0].systemPrompt = "";
  before.activeId = "technical";
  const fixture = memory(before), service = workspaces(fixture.repository, clock);
  const saved = await service.find(before.id);
  expect(saved.modes).toHaveLength(2);
  expect(saved.modes.find(mode => mode.id === "technical")?.instructions).toBe("");
  expect(saved.modes.find(mode => mode.id === "technical")?.systemPrompt).toBe("");
  expect(saved.activeId).toBe("technical");
  expect((await service.find(before.id)).revision).toBe(1);
});

test("legacy instructions that already contain the materialized base and identical author text are not duplicated", async () => {
  const before = legacy(), base = defaultModeInstructions("technical");
  before.systemPromptVersion = 1;
  const technical = before.modes.find(mode => mode.id === "technical");
  if (!technical) throw Error("Missing fixture mode");
  technical.instructions = base + "\n\nTexto existente integral";
  before.preferences.instructions = technical.instructions;
  before.preferences.modeInstructions.technical = technical.instructions;
  const fixture = memory(before), saved = await workspaces(fixture.repository, clock).find(before.id);
  expect(saved.modes.find(mode => mode.id === "technical")?.instructions).toBe(defaultRoleInstructions("technical") + "\n\nTexto existente integral");
  expect(saved.modes.find(mode => mode.id === "technical")?.systemPrompt).toBe(globalSystemPrompt("en"));
});

test("a reserved builtin identity collision fails without renaming or overwriting authored modes", async () => {
  const before = legacy();
  if (!before.modes[0]) throw Error("Missing fixture mode");
  before.modes[0].builtin = false;
  before.modes[0].instructions = "Texto autoral em identidade inconsistente";
  const fixture = memory(before);
  await expect(workspaces(fixture.repository, clock).find(before.id)).rejects.toMatchObject({ code: "workspace_conflict" });
  expect(fixture.saved()).toEqual(before);
});
