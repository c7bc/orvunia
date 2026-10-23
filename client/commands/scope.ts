import type { CommandContext } from "./ports.js";
import { requireCommandSession } from "./model.js";
export function commandScope(context: CommandContext) {
  const sessionId = requireCommandSession(context.state).id,
    workspace = context.ports.workspace(),
    generation = context.ports.coding.generation;
  return {
    sessionId,
    current: () =>
      context.state.current?.id === sessionId &&
      context.ports.workspace() === workspace &&
      context.ports.coding.generation === generation,
  };
}
