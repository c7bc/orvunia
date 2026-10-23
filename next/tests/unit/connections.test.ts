import { describe, expect, test } from "bun:test";
import { replacement } from "../../packages/connections/contracts.ts";
import { replaceConfiguration } from "../../packages/connections/replacement.ts";
import { migrateConnections } from "../../packages/connections/migration.ts";
import { legacyReplacement } from "../../packages/connections/legacy.ts";
import { configurationInput, initialConfiguration, legacyConnections } from "../support/connections.ts";
describe("personal connections v2 invariants", () => {
  test("preserves migration identity, secrets, limits and disabled vision", () => {
    const legacy = legacyConnections(false);
    const first = migrateConnections(legacy), second = migrateConnections(legacy);
    expect(first).toEqual(second);
    expect(first.bindings.vision).toEqual({ kind: "disabled" });
    expect(first.connections[0]?.parameters.maxTokens).toBe(3000);
    expect(first.secrets["secret-legacy-text"]).toEqual({ kind: "saved", value: "synthetic-secret-one" });
  });
  test("environment credentials require trusted origin and never copy the key", () => {
    const legacy = legacyConnections(); delete legacy.response.apiKey;
    expect(migrateConnections(legacy).secrets["secret-legacy-text"]).toBeUndefined();
    const value = migrateConnections(legacy, { trusted: (role) => role === "response" });
    expect(value.secrets["secret-legacy-text"]?.kind).toBe("environment");
    expect(JSON.stringify(value)).not.toContain("environment-secret");
  });
  test("rejects unknown fields, unsupported sharing, URLs and oversized keys", () => {
    const input = configurationInput(initialConfiguration());
    expect(replacement.safeParse({ ...input, apiKey: "secret" }).success).toBe(false);
    expect(replacement.safeParse({ ...input, bindings: { ...input.bindings,
      transcription: { kind: "shared", capability: "text" } } }).success).toBe(false);
    for (const baseUrl of ["http://evil.example.test", "https://user:password@example.test", "https://a.test/?key=x"])
      expect(replacement.safeParse({ ...input, connections: [{ ...input.connections[0], baseUrl }] }).success).toBe(false);
    expect(replacement.safeParse({ ...input, connections: [{ ...input.connections[0],
      secret: { operation: "replace", value: "x".repeat(1001) } }] }).success).toBe(false);
  });
  test("compare and swap detects profile and connection revisions", () => {
    const current = initialConfiguration(), input = configurationInput(current);
    expect(() => replaceConfiguration(current, { ...input, expectedRevision: 2 })).toThrow("connection_revision_conflict");
    expect(() => replaceConfiguration(current, { ...input, connections: input.connections.map((item) =>
      ({ ...item, revision: 8 })) })).toThrow("connection_revision_conflict");
    const next = replaceConfiguration(current, input);
    expect(next.revision).toBe(2); expect(next.connections[0]?.revision).toBe(2);
  });
  test("keep never forwards existing secret to a changed origin", () => {
    const current = initialConfiguration(), input = configurationInput(current);
    input.connections[0]!.baseUrl = "https://different.example.test/v1";
    expect(() => replaceConfiguration(current, input)).toThrow("connection_secret_origin_changed");
    const replaced = replaceConfiguration(current, { ...input, connections: input.connections.map((item) =>
      ({ ...item, secret: { operation: "clear" } })) });
    expect(replaced.secrets).toEqual({});
  });
  test("rejects missing capabilities, duplicate ids and provider contradictions", () => {
    const current = initialConfiguration(), input = configurationInput(current);
    expect(() => replaceConfiguration(current, { ...input, connections: [...input.connections, input.connections[0]] }))
      .toThrow("connection_invalid");
    expect(() => replaceConfiguration(current, { ...input, connections: input.connections.map((item) =>
      ({ ...item, capabilities: ["transcription"] })) })).toThrow("connection_invalid");
  });
  test("legacy writer preserves independent vision and its credentials", () => {
    const current = initialConfiguration();
    current.connections.push({ ...current.connections[0]!, id: "independent-vision", secretRef: "vision-secret" });
    current.secrets["vision-secret"] = { kind: "saved", value: "synthetic-vision" };
    current.bindings.vision = { kind: "api", connectionId: "independent-vision" };
    const next = replaceConfiguration(current, legacyReplacement(current, legacyConnections(false)));
    expect(next.bindings.vision).toEqual(current.bindings.vision);
    expect(next.secrets["independent-vision"]).toEqual({ kind: "saved", value: "synthetic-vision" });
  });
  test("maximum-length opaque identifiers retain independent, collision-free secrets", () => {
    const current = initialConfiguration(), input = configurationInput(current);
    const first = "a".repeat(159) + "1", second = "a".repeat(159) + "2";
    const base = input.connections[0]!;
    input.connections.push({ ...base, id: first, revision: 1, secret: { operation: "keep" } },
      { ...base, id: second, revision: 1, secret: { operation: "keep" } });
    const next = replaceConfiguration(current, { ...input, connections: input.connections.map((item) =>
      item.id === first || item.id === second ? { ...item, secret: { operation: "replace", value: `synthetic-${item.id.at(-1)}` } } : item) });
    expect(next.secrets[first]).toEqual({ kind: "saved", value: "synthetic-1" });
    expect(next.secrets[second]).toEqual({ kind: "saved", value: "synthetic-2" });
  });
});
