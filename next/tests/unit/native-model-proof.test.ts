import { expect, test } from "bun:test";
import { nativeSelectionVerifier, signNativeSelection } from "../../packages/local-models/native-proof.ts";

test("model picker grants reject altered paths, actors, origins, expiration and replay", () => {
  const token = "synthetic-native-secret".repeat(3);
  const now = Date.now();
  const selection = { requestId: crypto.randomUUID(), catalogId: "whisper-tiny", revision: "a".repeat(40),
    actor: "12", origin: "http://127.0.0.1:9915", path: process.platform === "win32" ? "C:\\models\\tiny.bin" : "/models/tiny.bin",
    nonce: crypto.randomUUID(), expiresAt: now + 1000 };
  const verify = nativeSelectionVerifier(token, selection.origin, () => now);
  const signed = signNativeSelection(selection, token);
  for (const changed of [{ actor: "13" }, { path: selection.path + "2" }, { origin: "https://other.test" }])
    expect(() => verify({ ...signed, selection: { ...selection, ...changed } })).toThrow("selection_invalid");
  expect(() => verify(signNativeSelection({ ...selection, expiresAt: now - 1 }, token))).toThrow("selection_invalid");
  expect(() => verify(signNativeSelection({ ...selection, expiresAt: now + 31_000 }, token))).toThrow("selection_invalid");
  expect(verify(signed)).toEqual(selection);
  expect(() => verify(signed)).toThrow("selection_invalid");
});
