import { RealtimeDrain } from "./drain.ts";
export function transcriptionTurns(
  drain: RealtimeDrain,
  latestTime: () => string,
  persist: (item: string, text: string, time: string, utteranceId?: string) => Promise<void>,
) {
  type Turn = { time: string; utteranceId?: string };
  const turns: Turn[] = [],
    items = new Map<string, Turn>(),
    completed = new Set<string>();
  const finals = new Map<string, string>(),
    acknowledgements = new Map<string, string | null>();
  let lastItem: string | null = null;
  const final = async (
    item: string,
    text: string,
    time = items.get(item)?.time ?? latestTime(),
  ) => {
    if (completed.has(item)) return;
    if (completed.size >= 8192) throw Error("Final transcript limit");
    await persist(item, text, time, items.get(item)?.utteranceId);
    completed.add(item);
    items.delete(item);
  };
  const settle = async () => {
    let item: string | null;
    while ((item = drain.nextItem()) && finals.has(item)) {
      await final(item, finals.get(item)!);
      finals.delete(item);
      drain.completed(item);
    }
  };
  return {
    final,
    utterance: (item: string) => items.get(item)?.utteranceId,
    commit(utteranceId?: string) {
      turns.push({ time: latestTime(), ...(utteranceId ? { utteranceId } : {}) });
    },
    async completed(item: string, text: string) {
      if (!completed.has(item)) {
        if (finals.size >= 256 && !finals.has(item))
          throw Error("Pending transcript limit");
        if (!finals.has(item)) finals.set(item, text);
      }
      await settle();
    },
    async acknowledged(item: string, previous: string | null | undefined) {
      if (
        completed.has(item) ||
        drain.hasCommitted(item) ||
        acknowledgements.has(item)
      )
        return;
      if (previous !== undefined && previous !== lastItem) {
        if (acknowledgements.size >= 256) throw Error("Acknowledgement limit");
        acknowledgements.set(item, previous);
        return;
      }
      const bind = (id: string) => {
        if (drain.committed(id)) {
          items.set(id, turns.shift() ?? { time: latestTime() });
          lastItem = id;
        }
      };
      bind(item);
      while (true) {
        const candidates = [...acknowledgements].filter(
          ([, prior]) => prior === lastItem,
        );
        if (candidates.length > 1) throw Error("Ambiguous commit order");
        const next = candidates[0]?.[0];
        if (!next) break;
        acknowledgements.delete(next);
        bind(next);
      }
      await settle();
    },
  };
}
