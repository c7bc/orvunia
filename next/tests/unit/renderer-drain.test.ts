import { expect, test } from "bun:test";
import { createRendererDrain } from "../../packages/desktop/renderer-drain.ts";
function contents() {
  const sent: { type: string; data: { ticket: string } }[] = [];
  return {
    sent,
    isDestroyed: () => false,
    send(_channel: string, value: unknown) {
      sent.push(value as (typeof sent)[number]);
    },
  };
}
test("draining accepts acknowledgments only from the owning renderer and ticket", async () => {
  const drain = createRendererDrain(),
    first = contents(),
    second = contents();
  for (const renderer of [first, second])
    drain.ready(renderer, { capabilities: ["renderer-drain/1"] });
  let completed = false;
  const pending = drain.drain([first, second]).then(() => {
    completed = true;
  });
  const ticket = first.sent[0]!.data.ticket;
  expect(drain.complete(second, { ticket, ok: true }).completed).toBe(false);
  expect(
    drain.complete(first, { ticket, ok: true, extra: true }).completed,
  ).toBe(false);
  expect(drain.complete(first, { ticket, ok: true }).completed).toBe(true);
  await Promise.resolve();
  expect(completed).toBe(false);
  expect(
    drain.complete(second, { ticket: second.sent[0]!.data.ticket, ok: true })
      .completed,
  ).toBe(true);
  await pending;
  expect(completed).toBe(true);
  expect(drain.complete(first, { ticket, ok: true }).completed).toBe(false);
});
test("navigation, explicit failure and timeout reject rather than approving shutdown", async () => {
  for (const failure of ["navigation", "failure", "timeout"] as const) {
    const drain = createRendererDrain(10),
      renderer = contents();
    drain.ready(renderer, { capabilities: ["renderer-drain/1"] });
    const pending = drain.drain([renderer]).then(
      () => null,
      (error: unknown) => error,
    );
    const ticket = renderer.sent[0]!.data.ticket;
    if (failure === "navigation") drain.forget(renderer);
    if (failure === "failure") drain.complete(renderer, { ticket, ok: false });
    expect(await pending).toBeInstanceOf(Error);
    expect(drain.complete(renderer, { ticket, ok: true }).completed).toBe(
      false,
    );
    if (failure === "navigation") {
      await drain.drain([renderer]);
      expect(renderer.sent.length).toBe(1);
    }
  }
});
test("cancel releases all waiters and ignores clients without the declared capability", async () => {
  const drain = createRendererDrain(),
    renderer = contents(),
    legacy = contents();
  drain.ready(renderer, { capabilities: ["renderer-drain/1"] });
  drain.ready(legacy, { capabilities: ["unknown"] });
  const pending = drain.drain([renderer, legacy]).then(
    () => null,
    (error: unknown) => error,
  );
  drain.cancel([renderer]);
  expect(String(await pending)).toContain("cancelled");
  expect(renderer.sent.at(-1)!.type).toBe("quit-cancelled");
  expect(legacy.sent.length).toBe(0);
});
