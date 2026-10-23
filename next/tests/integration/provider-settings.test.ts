import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { providerDefaults } from "../../packages/providers/defaults.ts";
import { providerSettings } from "../../packages/providers/settings.ts";
import { fileConnections } from "../../packages/providers/file.ts";
import { fileVault } from "../../packages/providers/vault.ts";
import { modelCatalog } from "../../packages/providers/catalog.ts";

test("local provider settings remain encrypted across restart and never return saved or environment keys", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cadence-providers-"));
  const filename = join(directory, "providers.json"),
    secret = "synthetic-private-saved-key";
  const repository = fileConnections(filename, fileVault(filename + ".key"));
  const options = {
    initial: providerDefaults({}),
    editable: true,
    repository,
    environmentKey: () => "synthetic-environment-key",
    protection: "file" as const,
  };
  try {
    const settings = await providerSettings(options);
    const input = providerDefaults({});
    input.response.apiKey = secret;
    await settings.save(input);
    expect(readFileSync(filename, "utf8")).not.toContain(secret);
    expect(JSON.stringify(settings.public())).not.toContain(secret);
    expect(JSON.stringify(settings.public())).not.toContain(
      "synthetic-environment-key",
    );
    const restarted = await providerSettings(options);
    expect(restarted.effective("response").apiKey).toBe(secret);
    const updated = { ...input, response: { ...input.response } };
    delete updated.response.apiKey;
    await restarted.save(updated);
    expect(restarted.effective("response").apiKey).toBe(secret);
    await restarted.save({
      ...updated,
      response: { ...updated.response, clearKey: true },
    });
    expect(restarted.effective("response").apiKey).toBe(
      "synthetic-environment-key",
    );
    writeFileSync(filename, "invalid encrypted payload");
    expect((await providerSettings(options)).public().loadError).toBe(
      "provider_settings_unreadable",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("endpoint changes cannot silently forward an unrelated credential", async () => {
  const initial = providerDefaults({});
  const settings = await providerSettings({
    initial,
    editable: true,
    protection: "file",
    repository: { read: async () => null, write: async () => {} },
    environmentKey: () => "synthetic-environment-key",
  });
  const different = {
    ...initial.response,
    baseUrl: "https://different.example.test/v1",
  };
  expect(settings.preview("response", different).apiKey).toBe("");
  await expect(
    modelCatalog(
      settings,
      "response",
      async () => {
        throw Error("Credential must not be sent");
      },
      different,
    ),
  ).rejects.toMatchObject({ code: "provider_not_configured" });
  await settings.save({ ...initial, response: different });
  expect(settings.effective("response").apiKey).toBe("");
  const authorized = { ...different, apiKey: "synthetic-explicit-key" };
  expect(settings.preview("response", authorized).apiKey).toBe(
    "synthetic-explicit-key",
  );
});

test("managed cloud connections reject client configuration changes before making a request", async () => {
  const initial = providerDefaults({});
  const settings = await providerSettings({
    initial,
    editable: false,
    protection: "managed",
    environmentKey: () => "synthetic",
  });
  await expect(settings.save(initial)).rejects.toMatchObject({ status: 403 });
  await expect(
    modelCatalog(
      settings,
      "response",
      async () => {
        throw Error("Must not execute");
      },
      initial.response,
    ),
  ).rejects.toMatchObject({ status: 403 });
  const result = await modelCatalog(
    settings,
    "response",
    async (_url, options) => {
      expect(options?.redirect).toBe("error");
      return Response.json({ data: [{ id: "first" }, { id: "second" }] });
    },
  );
  expect(result.models).toEqual(["first", "second"]);
});
