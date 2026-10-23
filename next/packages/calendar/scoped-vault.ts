import type { SecretVault } from "../providers/domain.ts";
export function scopedCalendarVault(vault: SecretVault): SecretVault {
  const prefix = "cadence.calendar/v1\0";
  return {
    seal: (value) => vault.seal(prefix + value),
    async open(value) {
      const decrypted = await vault.open(value);
      if (!decrypted.startsWith(prefix))
        throw Error("Invalid calendar secret scope");
      return decrypted.slice(prefix.length);
    },
  };
}
