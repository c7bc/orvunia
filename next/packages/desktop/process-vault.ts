import { desktopVaultClient } from "./vault-client.ts";
export function processVault(nonce: string | undefined) {
  if (!nonce) return null;
  if (!process.connected || !process.send)
    throw Error("Native vault requires its parent IPC channel");
  const client = desktopVaultClient({
    nonce,
    send: (message) => {
      if (!process.connected || !process.send)
        throw Error("Private IPC is unavailable");
      process.send(message, (error: Error | null) => {
        if (error) client.close();
      });
    },
  });
  const receive = (message: unknown) => {
    client.receive(message);
  };
  process.on("message", receive);
  return {
    vault: client.vault,
    close() {
      process.off("message", receive);
      client.close();
    },
  };
}
