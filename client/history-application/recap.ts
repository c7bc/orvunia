import type { PanelSession } from "../panel/data.js";
import type { HistoryPorts } from "./contracts.js";

export function createRecapReview<Session extends PanelSession>(
  ports: HistoryPorts<Session>,
) {
  let preparation = 0;
  async function review() {
    const session = ports.state.current;
    if (!session || ports.state.busy) return;
    const generation = ++preparation;
    const workspace = ports.workspace();
    const token = await ports.prepareGenerated(session.id);
    if (
      ports.state.current?.id !== session.id ||
      ports.workspace() !== workspace ||
      preparation !== generation
    )
      return;
    if (token.revision > 0) {
      ports.state.recapGeneration = token;
      ports.presentRecapConfirmation();
      return;
    }
    await ports.ask(token);
  }
  function fallback(sessionId: string, text: string, message: string) {
    if (ports.state.current?.id !== sessionId) return;
    ports.state.generatedRecapFallback = { sessionId, text };
    ports.presentGeneratedFallback(text, message);
  }
  return { review, fallback };
}
