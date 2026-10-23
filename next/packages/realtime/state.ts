import { RealtimeError } from "./domain.ts";
import { RealtimeDrain } from "./drain.ts";
import { transcriptionTurns } from "./turns.ts";
import { persistTranscript } from "./persist.ts";
import { hasMessage, message } from "../i18n/messages.ts";
import type { Peer, Ticket, Upstream, Permit } from "./domain.ts";
import type { RealtimeDependencies } from "./dependencies.ts";
import type { providerConfiguration } from "./provider-config.ts";
export type ChannelState = {
  dependencies: RealtimeDependencies;
  ticket: Ticket;
  peer: Peer;
  authorized(): Promise<boolean>;
  config: ReturnType<typeof providerConfiguration> | null;
  upstream: Upstream | null;
  permit: Permit | null;
  drain: RealtimeDrain;
  turns: ReturnType<typeof transcriptionTurns>;
  ready: boolean;
  closed: boolean;
  latestTime: string;
  pendingUtteranceId?: string | undefined;
  turnBytes: number;
  totalBytes: number;
  paddingBytes: number;
  windowBytes: number;
  windowStarted: number;
  send(value: unknown): void;
  forward(value: unknown): void;
  notices(): void;
};

export function createChannelState(
  dependencies: RealtimeDependencies,
  ticket: Ticket,
  peer: Peer,
  authorized: () => Promise<boolean>,
  provider: "openai" | "deepgram",
) {
  let state: ChannelState;
  const drain = new RealtimeDrain(provider, dependencies.clock);
  const send = (value: unknown) => {
    if (state.closed) return;
    const details = value && typeof value === "object" && "details" in value
      ? value.details as { resetAt?: string } | undefined : undefined;
    const presented =
      value &&
      typeof value === "object" &&
      "code" in value &&
      hasMessage(value.code)
        ? { ...value, message: message(value.code, ticket.locale) + (details?.resetAt ? ` (${details.resetAt} UTC)` : "") }
        : value;
    if (!peer.send(presented)) throw new RealtimeError("realtime_closed");
  };
  state = {
    dependencies,
    ticket,
    peer,
    authorized,
    drain,
    config: null,
    upstream: null,
    permit: null,
    ready: false,
    closed: false,
    latestTime: "00:00",
    turnBytes: 0,
    totalBytes: 0,
    paddingBytes: 0,
    windowBytes: 0,
    windowStarted: dependencies.clock(),
    send,
    turns: transcriptionTurns(
      drain,
      () => state.latestTime,
      async (item, text, time, utteranceId) => {
        if (!(await authorized())) throw new RealtimeError("realtime_closed");
        if (state.closed) return;
        const transcript = await persistTranscript(
          dependencies,
          ticket,
          item,
          text,
          time,
          utteranceId,
        );
        send({ type: "final", itemId: item, transcript });
      },
    ),
    forward: (value) => {
      const upstream = state.upstream;
      if (
        state.closed ||
        !upstream?.open() ||
        upstream.bufferedBytes() > 480000
      )
        throw new RealtimeError("realtime_closed");
      upstream.send(JSON.stringify(value));
    },
    notices: () => {
      for (const notice of drain.poll()) send(notice);
    },
  };
  return state;
}
