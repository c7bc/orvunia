import { readPrivateFile } from "../providers/private-file.ts";
import type { Repository, Vault } from "./domain.ts";
import { ConnectionError } from "./domain.ts";
import { configuration } from "./contracts.ts";
import { validateConfiguration } from "./validation.ts";
import { atomicWrite, missingFile } from "./atomic.ts";
import { configurationLock } from "./lock.ts";
export const maximumConfigurationBytes = 128 * 1024;
export function fileConfiguration(filename: string, vault: Vault): Repository {
  return {
    transaction: configurationLock(`${filename}.lock`),
    async read() {
      let bytes: Buffer;
      try { bytes = await readPrivateFile(filename, maximumConfigurationBytes); }
      catch (error) {
        if (missingFile(error)) return null;
        throw new ConnectionError("connection_settings_unreadable", 503);
      }
      try {
        const plaintext = await vault.open(bytes.toString("utf8"));
        if (Buffer.byteLength(plaintext) > maximumConfigurationBytes) throw Error("limit");
        return validateConfiguration(configuration.parse(JSON.parse(plaintext)));
      } catch { throw new ConnectionError("connection_settings_unreadable", 503); }
    },
    async write(value) {
      const serialized = JSON.stringify(validateConfiguration(configuration.parse(value)));
      if (Buffer.byteLength(serialized) > maximumConfigurationBytes) throw new ConnectionError("connection_invalid");
      const payload = await vault.seal(serialized);
      if (Buffer.byteLength(payload) > maximumConfigurationBytes) throw new ConnectionError("connection_invalid");
      await atomicWrite(filename, payload);
    },
  };
}
