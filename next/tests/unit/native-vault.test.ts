import { expect, test } from "bun:test";
import { nativeSecretVault } from "../../packages/desktop/native-vault.ts";
test("native vault preserves legacy Electron envelope and rejects weak Linux storage", async () => {
  let backend = "basic_text";
  const storage = {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => backend,
    encryptString: (value: string) => Buffer.from(`synthetic:${value}`),
    decryptString: (value: Buffer) => {
      if (!value.toString().startsWith("synthetic:"))
        throw Error("Invalid encryption");
      return value.toString().slice(10);
    },
  };
  expect(nativeSecretVault(storage, "linux")).toBeNull();
  backend = "kwallet6";
  const vault = nativeSecretVault(storage, "linux")!;
  expect(
    await vault.open(storage.encryptString("preserved").toString("base64")),
  ).toBe("preserved");
  expect(await vault.open(await vault.seal("new-value"))).toBe("new-value");
  await expect(vault.open("malformed!")).rejects.toThrow("envelope");
  await expect(vault.seal("x".repeat(40001))).rejects.toThrow("limit");
  expect(
    nativeSecretVault(
      { ...storage, isEncryptionAvailable: () => false },
      "win32",
    ),
  ).toBeNull();
});
