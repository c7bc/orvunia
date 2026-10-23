import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { desktopStartup } from "../../apps/desktop/startup.ts";
test("desktop initialization handles cancellation before readiness and releases every listener when the API takes ownership", () => {
  for (const event of ["SIGTERM", "SIGINT", "disconnect", "message"]) {
    const emitter = Object.assign(new EventEmitter(), { connected: true });
    const startup = desktopStartup(emitter as unknown as NodeJS.Process);
    emitter.emit("message", { type: "unrelated" });
    expect(startup.signal.aborted).toBe(false);
    emitter.emit(event, { type: "shutdown" });
    expect(startup.signal.aborted).toBe(true);
    startup.release();
    startup.release();
    expect(emitter.eventNames()).toEqual([]);
  }
  const parent = Object.assign(new EventEmitter(), { connected: false });
  const startup = desktopStartup(parent as unknown as NodeJS.Process);
  expect(startup.signal.aborted).toBe(true);
  startup.release();
});
