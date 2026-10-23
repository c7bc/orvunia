import { z } from "zod";
import { emptyWorkspace } from "../workspaces/defaults.ts";
import { customModeSchema } from "../contracts/modes.ts";
import {
  profileSchema,
  preferencesSchema,
  librarySchema,
} from "../contracts/workspace.ts";
import { definedFields } from "../contracts/defined.ts";
import type { Workspace } from "../workspaces/domain.ts";
import type { LegacyReader } from "./reader.ts";

export const storedMode = customModeSchema
  .extend({
    id: z.union([z.enum(["recruiter", "technical"]), z.uuid()]),
    builtin: z.boolean(),
    created: z.string(),
    updated: z.string(),
  })
  .strict()
  .transform(definedFields);
export function projectWorkspaces(
  reader: LegacyReader,
  now: string,
): Workspace[] {
  const modes = reader.rows("modes");
  return reader.rows("owners").map((row) => {
    const id = z.uuid().parse(row.id),
      workspace = emptyWorkspace(id, now);
    delete workspace.systemPromptVersion;
    if (row.profile)
      workspace.profile = profileSchema.parse(JSON.parse(String(row.profile)));
    if (row.preferences)
      workspace.preferences = preferencesSchema.parse(
        JSON.parse(String(row.preferences)),
      );
    if (row.library) {
      const library = librarySchema.parse(JSON.parse(String(row.library)));
      workspace.library = {
        ...library,
        documents: library.documents.map(definedFields),
      };
    }
    const saved = modes
      .filter((mode) => mode.owner === id)
      .map((mode) => storedMode.parse(JSON.parse(String(mode.data))));
    workspace.modes = workspace.modes.map((mode) => {
      const existing = saved.find((item) => item.id === mode.id);
      if (existing) return existing;
      const { systemPrompt: _newDefaultSystemPrompt, ...legacyMode } = mode;
      const notes = workspace.preferences.noteTemplates[mode.base];
      return {
        ...legacyMode,
        instructions: workspace.preferences.modeInstructions[mode.base],
        sections: !notes.trim()
          ? []
          : notes.startsWith("## ")
            ? notes.split(/\n(?=## )/).map((part) => {
                const [title, ...body] = part.split("\n");
                return {
                  title: (title ?? "").slice(3).trim(),
                  instructions: body.join("\n").trim(),
                };
              })
            : [{ title: "Notas", instructions: notes }],
        documents: workspace.library.documents
          .filter((document) => document.mode === mode.base)
          .map(({ mode: _mode, ...document }) => document),
      };
    });
    workspace.modes.push(
      ...saved.filter((mode) => !["recruiter", "technical"].includes(mode.id)),
    );
    workspace.activeId = workspace.modes.some(
      (mode) => mode.id === row.active_mode,
    )
      ? String(row.active_mode)
      : "recruiter";
    return workspace;
  });
}
