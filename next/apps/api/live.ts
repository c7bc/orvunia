import type { RealtimeDependencies } from "../../packages/realtime/dependencies.ts";
import { realtime } from "../../packages/realtime/service.ts";
import { memoryTickets } from "../../packages/realtime/tickets.ts";
import { localChannels } from "../../packages/realtime/admission.ts";
import { socketUpstream } from "../../packages/realtime/socket.ts";
import type { Composition } from "./composition.ts";
type Ports = Pick<
  RealtimeDependencies,
  "sessions" | "workspace" | "providers" | "usage" | "identity"
>;
export function composeLive(
  origin: string,
  composition: Composition,
  ports: Ports,
  coordination?: Pick<RealtimeDependencies, "tickets" | "admit">,
) {
  const identifier = () => crypto.randomUUID();
  return realtime({
    ...ports,
    origin,
    local: !coordination,
    clock: Date.now,
    identifier,
    tickets: coordination?.tickets ?? memoryTickets(Date.now),
    admit: coordination?.admit ?? localChannels(),
    upstream: composition.upstream ?? socketUpstream,
    log: composition.log,
  });
}
