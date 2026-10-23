import type { SecretVault } from "../providers/domain.ts";
export interface NativeSecretStorage {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}
export function nativeSecretVault(
  storage: NativeSecretStorage,
  platform: string,
): SecretVault | null {
  if (!storage.isEncryptionAvailable()) return null;
  if (
    platform === "linux" &&
    !["gnome_libsecret", "kwallet", "kwallet5", "kwallet6"].includes(
      storage.getSelectedStorageBackend?.() ?? "",
    )
  )
    return null;
  return {
    async seal(value) {
      if (Buffer.byteLength(value, "utf8") > 40000)
        throw Error("Native vault payload exceeds its limit");
      return storage.encryptString(value).toString("base64");
    },
    async open(value) {
      if (
        !value ||
        value.length > 60000 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          value,
        )
      )
        throw Error("Invalid native vault envelope");
      return storage.decryptString(Buffer.from(value, "base64"));
    },
  };
}
