import { expect, test } from "bun:test";
import { emptyWorkspace } from "../../packages/workspaces/defaults.ts";
import { materializeWorkspacePrompts } from "../../packages/workspaces/prompt-migration.ts";
import { defaultModeInstructions, defaultModeSystemPrompt, modeTemplates } from "../../packages/workspaces/templates.ts";
import { globalSystemPrompt } from "../../packages/prompts/global.ts";
import { defaultRoleInstructions } from "../../packages/prompts/mode-instructions.ts";
import { workspaces } from "../../packages/workspaces/service.ts";
import { modes } from "../../packages/workspaces/modes.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";

const now = "2026-10-20T00:00:00.000Z";
function previous() {
  const workspace = emptyWorkspace(crypto.randomUUID(), now);
  workspace.systemPromptVersion = 1;
  for (const mode of workspace.modes) {
    delete mode.systemPrompt;
    mode.instructions = defaultModeInstructions(mode.base);
  }
  return workspace;
}

test("version one splits only the exact stock prefix and preserves authored suffix bytes and timestamps", () => {
  const original = previous(), mode = original.modes.find(value => value.id === "technical");
  if (!mode) throw Error("Missing fixture mode");
  const authored = "  Minha instrução adicional, sem correção.\n\n ";
  mode.instructions += "\n\n" + authored;
  const before = structuredClone(original), migrated = materializeWorkspacePrompts(original, now);
  expect(migrated?.systemPromptVersion).toBe(3);
  expect(migrated?.modes.find(value => value.id === mode.id)?.instructions).toBe(defaultRoleInstructions("technical") + "\n\n" + authored);
  expect(migrated?.modes.find(value => value.id === mode.id)?.systemPrompt).toBe(globalSystemPrompt("en"));
  expect(migrated?.modes.find(value => value.id === mode.id)?.created).toBe(mode.created);
  expect(migrated?.modes.find(value => value.id === mode.id)?.updated).toBe(mode.updated);
  expect(original).toEqual(before);
  if (!migrated) throw Error("Missing migrated fixture");
  expect(materializeWorkspacePrompts(migrated, now)).toBeNull();
});

test("an erased version-one prompt stays two empty fields instead of acquiring a new English default", () => {
  const original = previous();
  for (const mode of original.modes) mode.instructions = "";
  const migrated = materializeWorkspacePrompts(original, now);
  expect(migrated?.systemPromptVersion).toBe(3);
  expect(migrated?.modes.every(mode => mode.systemPrompt === "" && mode.instructions === "")).toBe(true);
});

test("new legacy author preferences remain visible without resurrecting a version-one erased system prompt", () => {
  const original = previous();
  for (const mode of original.modes) mode.instructions = "";
  original.preferences.instructions = "Nova preferência autoral";
  original.preferences.modeInstructions.technical = "Regra técnica autoral";
  const migrated = materializeWorkspacePrompts(original, now), mode = migrated?.modes.find(value => value.id === "technical");
  expect(mode?.systemPrompt).toBe("");
  expect(mode?.instructions).toBe("Regra técnica autoral\n\nNova preferência autoral");
  expect(migrated?.preferences.instructions).toBe("");
  expect(migrated?.preferences.modeInstructions).toEqual({ recruiter: "", technical: "" });
  if (!migrated) throw Error("Missing migrated fixture");
  expect(materializeWorkspacePrompts(migrated, now)).toBeNull();
});

test("a modified or unrecognized legacy prefix is retained in full rather than destructively stripped", () => {
  const original = previous(), mode = original.modes[0];
  if (!mode) throw Error("Missing fixture mode");
  mode.instructions = "Custom edited opening\n" + mode.instructions.slice(1) + "\nMeu encerramento";
  const migrated = materializeWorkspacePrompts(original, now)?.modes[0];
  expect(migrated?.instructions).toBe(defaultRoleInstructions(mode.base) + "\n\n" + mode.instructions);
  expect(migrated?.systemPrompt).toBe(globalSystemPrompt("en"));
});

test("existing English or explicitly empty system prompt fields remain literal during version migration", () => {
  for (const systemPrompt of ["", "My authored system prompt"] as const) {
    const original = previous(), mode = original.modes[0];
    if (!mode) throw Error("Missing fixture mode");
    mode.systemPrompt = systemPrompt;
    mode.instructions = "Author instructions remain separate";
    const migrated = materializeWorkspacePrompts(original, now)?.modes[0];
    expect(migrated?.systemPrompt).toBe(systemPrompt);
    expect(migrated?.instructions).toBe(mode.instructions);
  }
});

test("raw pre-version-one empty modes get English defaults and preserve whitespace-only authored instructions", () => {
  const original = previous();
  delete original.systemPromptVersion;
  for (const mode of original.modes) mode.instructions = "";
  original.preferences.instructions = "  ";
  const migrated = materializeWorkspacePrompts(original, now);
  expect(migrated?.modes.every(mode => mode.systemPrompt === globalSystemPrompt("en"))).toBe(true);
  expect(migrated?.modes.every(mode => mode.instructions === defaultRoleInstructions(mode.base) + "\n\n  ")).toBe(true);
  expect(migrated?.preferences.instructions).toBe("");
});

test("new blank and template modes persist system prompts separately and omitted edits preserve them", async () => {
  const connection = sqliteConnection(":memory:");
  try {
    await migrateSqlite(connection);
    const service = workspaces(new SqliteWorkspaces(connection), () => new Date(now));
    const modeService = modes(service, () => crypto.randomUUID(), () => new Date(now)), owner = crypto.randomUUID();
    const blank = await modeService.create(owner, { base: "technical" });
    expect(blank.mode.systemPrompt).toBe(globalSystemPrompt("en"));
    expect(blank.mode.instructions).toBe("");
    const template = modeTemplates[0];
    if (!template) throw Error("Missing fixture template");
    const created = await modeService.create(owner, { templateId: template.id });
    expect(created.mode.systemPrompt).toBe(template.systemPrompt);
    expect(created.mode.instructions).toBe(template.instructions);
    const edited = await modeService.edit(owner, blank.mode.id, { instructions: "Only instructions changed" });
    expect(edited.mode.systemPrompt).toBe(blank.mode.systemPrompt);
    await modeService.edit(owner, blank.mode.id, { systemPrompt: "", instructions: "" });
    const reloaded = await workspaces(new SqliteWorkspaces(connection), () => new Date(now)).find(owner);
    expect(reloaded.modes.find(mode => mode.id === blank.mode.id)?.systemPrompt).toBe("");
    expect(reloaded.modes.find(mode => mode.id === blank.mode.id)?.instructions).toBe("");
  } finally { connection.close(); }
});
