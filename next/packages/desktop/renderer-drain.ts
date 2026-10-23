import { randomUUID } from "node:crypto";
import { z } from "zod";
export type DrainingContents = {
  isDestroyed(): boolean;
  send(channel: string, value: unknown): void;
};
const acknowledgement = z
  .object({ ticket: z.uuid(), ok: z.boolean() })
  .strict();
export function createRendererDrain(timeoutMs = 20000) {
  const ready = new WeakSet<DrainingContents>();
  let requested = 0,
    saved = 0;
  const pending = new Map<
    string,
    { contents: DrainingContents; finish(error?: Error): void }
  >();
  function drain(contents: readonly DrainingContents[]) {
    return Promise.all(
      contents
        .filter((value) => ready.has(value) && !value.isDestroyed())
        .map(
          (value) =>
            new Promise<void>((resolve, reject) => {
              const ticket = randomUUID();
              const timer = setTimeout(
                () =>
                  finish(
                    Error(
                      "Renderer changes could not be saved before shutdown",
                    ),
                  ),
                timeoutMs,
              );
              function finish(error?: Error) {
                if (!pending.has(ticket)) return;
                clearTimeout(timer);
                pending.delete(ticket);
                error ? reject(error) : resolve();
              }
              pending.set(ticket, { contents: value, finish });
              requested++;
              try {
                value.send("cadence:event", {
                  type: "prepare-quit",
                  data: { ticket },
                });
              } catch {
                finish(Error("Renderer shutdown request failed"));
              }
            }),
        ),
    );
  }
  return {
    ready(contents: DrainingContents, value: unknown) {
      const checked = z
        .object({ capabilities: z.tuple([z.literal("renderer-drain/1")]) })
        .strict()
        .safeParse(value);
      if (checked.success) ready.add(contents);
    },
    forget(contents: DrainingContents) {
      ready.delete(contents);
      for (const request of [...pending.values()])
        if (request.contents === contents)
          request.finish(Error("Renderer changed before saving completed"));
    },
    complete(contents: DrainingContents, value: unknown) {
      const checked = acknowledgement.safeParse(value);
      if (!checked.success) return { completed: false };
      const request = pending.get(checked.data.ticket);
      if (!request || request.contents !== contents)
        return { completed: false };
      if (checked.data.ok) saved++;
      request.finish(
        checked.data.ok
          ? undefined
          : Error("Renderer changes require review before shutdown"),
      );
      return { completed: true };
    },
    drain,
    snapshot: () => ({ requested, saved, pending: pending.size }),
    cancel(contents: readonly DrainingContents[]) {
      for (const request of [...pending.values()])
        request.finish(Error("Renderer shutdown cancelled"));
      for (const value of contents)
        if (!value.isDestroyed()) {
          try {
            value.send("cadence:event", { type: "quit-cancelled", data: null });
          } catch {}
        }
    },
  };
}
