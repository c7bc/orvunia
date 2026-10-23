import type { CommandContext } from "./ports.js";
import { runCodingContextCommands } from "./coding-context.js";
import { runCodingAnswerCommands } from "./coding-answer.js";
import { runHistoryCommands } from "./history.js";
import { runModesCommands } from "./modes.js";
import { runReviewCommands } from "./review.js";
import { runNavigationCommands } from "./navigation.js";
import { runSystemCommands } from "./system.js";
import { runContentCommands } from "./content.js";
export async function runDesktopAction(
  context: CommandContext,
  name: string,
): Promise<void> {
  const [key = "", value = ""] = name.split(":");
  const codingSession = key.startsWith("coding-")
    ? context.ports.document.querySelector<HTMLElement>(
        "#dialogs .coding-dialog",
      )?.dataset.session
    : null;
  if (codingSession && codingSession !== context.state.current?.id) {
    context.ports.closeModal();
    context.ports.toast(
      "Reabra a sessão da solicitação antes de tentar novamente.",
    );
    return;
  }
  for (const handler of [
    runCodingContextCommands,
    runCodingAnswerCommands,
    runHistoryCommands,
    runModesCommands,
    runReviewCommands,
    runNavigationCommands,
    runSystemCommands,
    runContentCommands,
  ])
    if (await handler(context, key, value)) return;
}
