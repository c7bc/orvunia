import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileVault } from "../../packages/providers/vault.ts";
import { fileConnections } from "../../packages/providers/file.ts";
import { fileConfiguration } from "../../packages/connections/file.ts";
import { composeConnections } from "../../packages/connections/compose.ts";
import { promoteConfiguration } from "../../packages/connections/promotion.ts";
import { connectionService } from "../../packages/connections/service.ts";
import { initialConfiguration, legacyConnections, configurationInput, temporaryConnections } from "../support/connections.ts";
describe("encrypted configuration migration", () => {
  test("migrates encrypted original without changing its bytes, restart keeps v2 writes", async () => {
    const fixture = await temporaryConnections();
    try {
      const vault = fileVault(join(fixture.directory, "vault.key"), "cadence.providers/v1", 128 * 1024);
      const filename = join(fixture.directory, "providers.next.json");
      await fileConnections(filename, vault).write(legacyConnections(false));
      const original = await readFile(filename);
      const options = { directory: fixture.directory, vault, initial: legacyConnections(),
        environment: { trusted: () => false }, installationSupports: async () => false, environmentKey: () => "" };
      const service = await composeConnections(options);
      expect((await service.public()).bindings.vision.kind).toBe("disabled");
      const input = configurationInput(await service.configuration());
      input.connections[0]!.model = "synthetic-new-model";
      await service.save(input);
      const restarted = await composeConnections(options);
      expect((await restarted.public()).connections[0]?.model).toBe("synthetic-new-model");
      expect(await readFile(filename)).toEqual(original);
      expect((await readFile(join(fixture.directory, "providers.v2.json"), "utf8"))).not.toContain("synthetic-secret");
      expect(JSON.stringify(await restarted.public())).not.toContain("synthetic-secret");
      expect((await restarted.effective("legacy-text")).apiKey).toBe("synthetic-secret-one");
    } finally { await fixture.cleanup(); }
  });
  for (const boundary of ["preparing", "config-written", "active"] as const) {
    test(`recovers crash at ${boundary} without remigrating or losing secrets`, async () => {
      const fixture = await temporaryConnections();
      try {
        const filename = join(fixture.directory, "providers.v2.json");
        const repository = fileConfiguration(filename, fileVault(join(fixture.directory, "key")));
        const options = { filename, repository, journal: join(fixture.directory, "journal.json"),
          initial: async () => initialConfiguration() };
        await expect(promoteConfiguration({ ...options, checkpoint: async (state) => {
          if (state === boundary) throw Error("synthetic-crash");
        } })).rejects.toThrow("synthetic-crash");
        expect(await promoteConfiguration(options)).toEqual(initialConfiguration());
        expect(JSON.parse(await readFile(options.journal, "utf8")).state).toBe("active");
      } finally { await fixture.cleanup(); }
    });
  }
  test("corrupt ciphertext and wrong vault never become empty defaults", async () => {
    const fixture = await temporaryConnections();
    try {
      const filename = join(fixture.directory, "providers.v2.json");
      const repository = fileConfiguration(filename, fileVault(join(fixture.directory, "key")));
      await repository.write(initialConfiguration());
      const wrong = fileConfiguration(filename, fileVault(join(fixture.directory, "wrong-key")));
      await expect(wrong.read()).rejects.toThrow("connection_settings_unreadable");
      await writeFile(filename, "corrupt-synthetic-ciphertext");
      await expect(repository.read()).rejects.toThrow("connection_settings_unreadable");
    } finally { await fixture.cleanup(); }
  });
  test("concurrent CAS preserves one winner and local capability must exist", async () => {
    const fixture = await temporaryConnections();
    try {
      const repository = fileConfiguration(join(fixture.directory, "providers.v2.json"), fileVault(join(fixture.directory, "key")));
      await repository.write(initialConfiguration());
      const service = connectionService({ repository, installationSupports: async () => false, environmentKey: () => "" });
      const input = configurationInput(initialConfiguration());
      const results = await Promise.allSettled([service.save(input), service.save(input)]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect((await repository.read())?.revision).toBe(2);
      const local = configurationInput((await repository.read())!);
      local.bindings.transcription = { kind: "local", installationId: "missing-local" };
      await expect(service.save(local)).rejects.toThrow("connection_invalid");
      expect((await repository.read())?.revision).toBe(2);
    } finally { await fixture.cleanup(); }
  });
});
