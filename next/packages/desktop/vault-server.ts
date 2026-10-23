import { timingSafeEqual } from "node:crypto";
import type { SecretVault } from "../providers/domain.ts";
import { parentNonce, vaultRequest } from "./vault-protocol.ts";
import type { VaultResult } from "./vault-protocol.ts";
export function desktopVaultServer(dependencies: {
  nonce: string;
  vault: SecretVault;
  send(message: VaultResult): void;
}) {
  const expected = Buffer.from(parentNonce.parse(dependencies.nonce));
  const pending = new Set<string>();
  let closed = false;
  return {
    async receive(input: unknown) {
      const parsed = vaultRequest.safeParse(input);
      if (
        closed ||
        !parsed.success ||
        !timingSafeEqual(expected, Buffer.from(parsed.data.nonce))
      )
        return false;
      const request = parsed.data,
        envelope = {
          type: "vault_result" as const,
          nonce: dependencies.nonce,
          requestId: request.requestId,
        };
      if (pending.has(request.requestId)) return true;
      if (pending.size >= 4) {
        dependencies.send({ ...envelope, ok: false });
        return true;
      }
      pending.add(request.requestId);
      try {
        const value = await dependencies.vault[request.operation](
          request.value,
        );
        if (!closed)
          dependencies.send(
            value.length <= 60000
              ? { ...envelope, ok: true, value }
              : { ...envelope, ok: false },
          );
      } catch {
        if (!closed) dependencies.send({ ...envelope, ok: false });
      } finally {
        pending.delete(request.requestId);
      }
      return true;
    },
    close() {
      closed = true;
      pending.clear();
    },
  };
}
