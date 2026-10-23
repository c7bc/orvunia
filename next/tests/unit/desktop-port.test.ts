import { expect, test } from "bun:test";
import { desktopPort } from "../../packages/desktop/port.ts";

test("desktop port selection refuses an occupied range and releases its probe before returning", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response(),
  });
  const port = server.port!;
  try {
    await expect(desktopPort(port, port + 1)).rejects.toThrow("Nenhuma porta");
  } finally {
    await server.stop();
  }
  expect(await desktopPort(port, port + 1)).toBe(port);
  await expect(desktopPort(1, 20)).rejects.toThrow("Invalid");
});
