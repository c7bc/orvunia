import type { ChannelState } from "./state.ts";
import type { TranscriptionConnection } from "../providers/domain.ts";
import { RealtimeError } from "./domain.ts";
import { providerConfiguration } from "./provider-config.ts";
import { assertLive } from "./guard.ts";
import { providerEvent } from "./provider-events.ts";
export async function initializeChannel(
  state: ChannelState,
  connection: TranscriptionConnection & { apiKey: string },
  enqueue: (size: number, work: () => Promise<void>) => void,
  stop: () => void,
) {
  const { dependencies, ticket } = state;
  state.permit = await dependencies.admit(ticket.workspaceId);
  if (!(await state.authorized())) throw new RealtimeError("realtime_closed");
  await assertLive(state);
  const workspace = await dependencies.workspace.find(ticket.workspaceId);
  const session = await assertLive(state);
  const config = (state.config = providerConfiguration(
    connection,
    ticket.workspaceId,
    workspace.preferences.audio,
    workspace.profile?.tags ?? "",
    session.mode === "technical",
  ));
  const upstream = (state.upstream = dependencies.upstream(
    config.address,
    config.headers,
  ));
  upstream.opened(() =>
    enqueue(0, async () => {
      await assertLive(state);
      if (config.update) state.forward(config.update);
      else {
        state.ready = true;
        state.send({ type: "ready", model: config.model, supportsFlush: true });
      }
    }),
  );
  upstream.message((input) => {
    if (typeof input !== "string" || Buffer.byteLength(input) > 1024 * 1024) {
      stop();
      return;
    }
    enqueue(Buffer.byteLength(input), async () => {
      await assertLive(state);
      await providerEvent(state, input);
    });
  });
  upstream.ended(stop);
}
