import type { Permit } from "./domain.ts";
import { RealtimeError } from "./domain.ts";
export function localChannels() {
  const counts = new Map<string, number>();
  return async (workspaceId: string): Promise<Permit> => {
    const current = counts.get(workspaceId) ?? 0;
    if (current >= 2) throw new RealtimeError("realtime_limit", 429);
    counts.set(workspaceId, current + 1);
    let released = false;
    return {
      renew: async () => !released,
      async release() {
        if (released) return;
        released = true;
        const remaining = (counts.get(workspaceId) ?? 1) - 1;
        remaining
          ? counts.set(workspaceId, remaining)
          : counts.delete(workspaceId);
      },
    };
  };
}
