import { defaultModeInstructions } from "./defaults.ts";
import { defaultModeSystemPrompt } from "./defaults-en.ts";
import { globalSystemPrompt } from "./global.ts";
import { recognizedLegacyRoleInstructions } from "./legacy-role.ts";

type ModePrompt = { base: "recruiter" | "technical"; systemPrompt?: string; instructions: string };
type Configuration = { systemPrompt: string; instructions: string };

function previousConfiguration(mode: ModePrompt, version: number | undefined): Configuration {
  if (mode.systemPrompt !== undefined) return { systemPrompt: mode.systemPrompt, instructions: mode.instructions };
  if (version === 1 && mode.instructions === "") return { systemPrompt: "", instructions: "" };
  const stock = defaultModeInstructions(mode.base);
  let instructions = mode.instructions;
  if (version === 1) {
    if (instructions === stock) instructions = "";
    else if (instructions.startsWith(stock + "\n\n")) instructions = instructions.slice(stock.length + 2);
    else if (instructions.startsWith(stock + "\n")) instructions = instructions.slice(stock.length + 1);
  }
  return { systemPrompt: defaultModeSystemPrompt(mode.base), instructions };
}

export function upgradeModePrompts<Mode extends ModePrompt>(
  mode: Mode, version: number | undefined,
): Omit<Mode, "systemPrompt" | "instructions"> & Configuration {
  if (version !== undefined && version >= 3)
    return { ...mode, systemPrompt: mode.systemPrompt ?? "", instructions: mode.instructions };
  const previous = previousConfiguration(mode, version);
  const role = recognizedLegacyRoleInstructions(previous.systemPrompt);
  if (role === null) return { ...mode, ...previous };
  const alreadyIncluded = previous.instructions === role || previous.instructions.startsWith(role + "\n\n");
  return { ...mode, systemPrompt: globalSystemPrompt("en"),
    instructions: alreadyIncluded ? previous.instructions : [role, previous.instructions].filter(text => text.length > 0).join("\n\n") };
}
