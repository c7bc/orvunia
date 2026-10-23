import type { SecretVault } from "../providers/domain.ts";
import { parentNonce, vaultResult } from "./vault-protocol.ts";
import type { VaultRequest } from "./vault-protocol.ts";
type Pending = {
  resolve(value: string): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};
export function desktopVaultClient(dependencies: {
  nonce: string;
  send(message: VaultRequest): void;
  timeoutMs?: number;
}) {
  const nonce = parentNonce.parse(dependencies.nonce),
    pending = new Map<string, Pending>();
  let closed = false;
  function call(operation: "seal" | "open", value: string) {
    if (closed || pending.size >= 4 || !value || value.length > 60000)
      return Promise.reject(Error("Operating-system vault is unavailable"));
    const requestId = crypto.randomUUID();
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(Error("Operating-system vault did not respond"));
      }, dependencies.timeoutMs ?? 5000);
      pending.set(requestId, { resolve, reject, timer });
      try {
        dependencies.send({
          type: "vault_request",
          nonce,
          requestId,
          operation,
          value,
        });
      } catch {
        clearTimeout(timer);
        pending.delete(requestId);
        reject(Error("Operating-system vault is disconnected"));
      }
    });
  }
  const vault: SecretVault = {
    seal: (value) => call("seal", value),
    open: (value) => call("open", value),
  };
  return {
    vault,
    receive(input: unknown) {
      const parsed = vaultResult.safeParse(input);
      if (!parsed.success || parsed.data.nonce !== nonce) return false;
      const result = parsed.data,
        request = pending.get(result.requestId);
      if (!request) return false;
      pending.delete(result.requestId);
      clearTimeout(request.timer);
      if (result.ok) request.resolve(result.value);
      else request.reject(Error("Operating-system vault operation failed"));
      return true;
    },
    close() {
      closed = true;
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(Error("Operating-system vault is disconnected"));
      }
      pending.clear();
    },
  };
}
