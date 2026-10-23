import type { Ticket, TicketStore } from "./domain.ts";
import { RealtimeError } from "./domain.ts";
export function memoryTickets(clock: () => number): TicketStore {
  const pending = new Map<string, Ticket>();
  return {
    async put(ticket) {
      for (const [key, item] of pending)
        if (item.expiresAt <= clock()) pending.delete(key);
      if (pending.size >= 200) throw new RealtimeError("realtime_limit", 429);
      if (pending.has(ticket.id)) throw Error("Duplicate realtime ticket");
      pending.set(ticket.id, structuredClone(ticket));
    },
    async take(id) {
      const ticket = pending.get(id);
      pending.delete(id);
      return ticket && ticket.expiresAt > clock() ? ticket : null;
    },
  };
}
