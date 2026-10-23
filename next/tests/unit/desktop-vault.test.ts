import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { desktopVaultClient } from "../../packages/desktop/vault-client.ts";
import { desktopVaultServer } from "../../packages/desktop/vault-server.ts";
import type { VaultRequest } from "../../packages/desktop/vault-protocol.ts";
test("private vault channel round-trips without exporting the vault capability or accepting another parent's messages", async () => {
  const nonce = randomBytes(32).toString("base64url"),
    requests: VaultRequest[] = [];
  let calls = 0;
  const client = desktopVaultClient({
    nonce,
    send: (message) => {
      requests.push(message);
      queueMicrotask(() => {
        void server.receive(message);
      });
    },
  });
  const server = desktopVaultServer({
    nonce,
    vault: {
      seal: async (value) => {
        calls++;
        return "synthetic:" + value;
      },
      open: async (value) => value.slice(10),
    },
    send: (message) => {
      client.receive(message);
    },
  });
  try {
    expect(await client.vault.seal("private synthetic value")).toBe(
      "synthetic:private synthetic value",
    );
    expect(await client.vault.open("synthetic:private synthetic value")).toBe(
      "private synthetic value",
    );
    expect(
      await server.receive({
        ...requests[0],
        nonce: randomBytes(32).toString("base64url"),
      }),
    ).toBe(false);
    expect(
      await server.receive({ ...requests[0], arbitraryMethod: "exportKey" }),
    ).toBe(false);
    expect(calls).toBe(1);
  } finally {
    client.close();
    server.close();
  }
});
test("vault failures expose no native exception, and disconnected operations reject promptly", async () => {
  const nonce = randomBytes(32).toString("base64url");
  const client = desktopVaultClient({
    nonce,
    send: (message) => {
      void server.receive(message);
    },
  });
  const server = desktopVaultServer({
    nonce,
    vault: {
      seal: async () => {
        throw Error("Synthetic OS error containing a private value");
      },
      open: async () => new Promise<string>(() => {}),
    },
    send: (message) => {
      client.receive(message);
    },
  });
  try {
    await expect(client.vault.seal("synthetic")).rejects.toThrow(
      "Operating-system vault operation failed",
    );
    const pending = client.vault.open("synthetic");
    const rejected = pending.catch((error: unknown) => error);
    client.close();
    expect(await rejected).toMatchObject({
      message: "Operating-system vault is disconnected",
    });
    await expect(client.vault.seal("synthetic")).rejects.toThrow("unavailable");
  } finally {
    client.close();
    server.close();
  }
});
test("vault timeout, request bounds and wrong reply nonce cannot release private values", async () => {
  const nonce = randomBytes(32).toString("base64url"),
    messages: VaultRequest[] = [],
    client = desktopVaultClient({
      nonce,
      timeoutMs: 10,
      send: (message) => {
        messages.push(message);
      },
    });
  try {
    const pending = client.vault.open("synthetic"),
      rejected = pending.catch((error: unknown) => error);
    expect(
      client.receive({
        type: "vault_result",
        requestId: messages[0]!.requestId,
        nonce: randomBytes(32).toString("base64url"),
        ok: true,
        value: "wrong",
      }),
    ).toBe(false);
    expect(await rejected).toMatchObject({
      message: "Operating-system vault did not respond",
    });
    expect(
      client.receive({
        type: "vault_result",
        requestId: messages[0]!.requestId,
        nonce,
        ok: true,
        value: "late",
      }),
    ).toBe(false);
    await expect(client.vault.seal("x".repeat(60001))).rejects.toThrow(
      "unavailable",
    );
  } finally {
    client.close();
  }
});
