import { expect, test } from "bun:test";
import { selectedModeConfiguration, selectedModePrompt } from "../../packages/answers/mode-prompt.ts";
import { emptyWorkspace } from "../../packages/workspaces/defaults.ts";
import type { ModeSnapshot } from "../../packages/sessions/domain.ts";

function fixture() {
  const workspace = emptyWorkspace("synthetic", "2026-01-01T00:00:00Z");
  const technical = workspace.modes.find(mode => mode.id === "technical")!;
  const snapshot: ModeSnapshot = { ...structuredClone(technical), id: crypto.randomUUID(),
    systemPrompt: "SNAPSHOT_SYSTEM", instructions: "SNAPSHOT_DETAILS" };
  return { workspace, technical, snapshot };
}

test("the selected live mode supplies both independently authored fields, including deliberate blanks", () => {
  const { workspace, technical } = fixture();
  for (const [systemPrompt, instructions] of [["LIVE_SYSTEM", "LIVE_DETAILS"], ["", "DETAILS"], ["SYSTEM", ""], ["", ""]] as const) {
    Object.assign(technical, { systemPrompt, instructions });
    expect(selectedModeConfiguration(workspace, null, "technical")).toEqual({ systemPrompt, instructions });
  }
});

test("live selected custom fields override its old snapshot while deleted modes preserve both snapshot fields", () => {
  const { workspace, snapshot } = fixture();
  const live = { ...structuredClone(workspace.modes[0]!), ...snapshot, systemPrompt: "", instructions: "LIVE_DETAILS" };
  workspace.modes.push(live);
  expect(selectedModeConfiguration(workspace, snapshot, "technical")).toEqual({ systemPrompt: "", instructions: "LIVE_DETAILS" });
  workspace.modes.pop();
  expect(selectedModeConfiguration(workspace, snapshot, "technical")).toEqual({ systemPrompt: "SNAPSHOT_SYSTEM", instructions: "SNAPSHOT_DETAILS" });
  delete snapshot.systemPrompt;
  expect(selectedModeConfiguration(workspace, snapshot, "technical")).toEqual({ systemPrompt: "", instructions: "SNAPSHOT_DETAILS" });
});

test("a different mode base cannot borrow a snapshot and compatibility helpers return only authored instructions", () => {
  const { workspace, technical, snapshot } = fixture();
  technical.systemPrompt = "TECHNICAL_SYSTEM"; technical.instructions = "TECHNICAL_DETAILS";
  snapshot.base = "recruiter";
  expect(selectedModeConfiguration(workspace, snapshot, "technical")).toEqual({ systemPrompt: "TECHNICAL_SYSTEM", instructions: "TECHNICAL_DETAILS" });
  expect(selectedModePrompt(workspace, snapshot, "technical")).toBe("TECHNICAL_DETAILS");
  workspace.modes = [];
  workspace.preferences.modeInstructions.technical = "LEGACY_AUTHORED_DETAILS";
  expect(selectedModeConfiguration(workspace, null, "technical")).toEqual({ systemPrompt: "", instructions: "LEGACY_AUTHORED_DETAILS" });
});
