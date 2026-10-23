import { expect, test } from "bun:test";
import { mkdtemp, rm, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { legacyInstallation } from "../support/legacy-installation.ts";
import { stageLegacyInstallation } from "../../packages/migration/installation.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { SqliteCalendar } from "../../packages/storage/sqlite/calendar.ts";
import { fileVault } from "../../packages/providers/vault.ts";
import { fileConnections } from "../../packages/providers/file.ts";
import { calendar } from "../../packages/calendar/service.ts";

test("installation staging preserves onboarding, cached calendar, OAuth state and provider connections in new encrypted stores", async () => {
  const directory = await mkdtemp(
      join(tmpdir(), "cadence-installation-import-"),
    ),
    source = join(directory, "legacy"),
    target = join(directory, "staged"),
    fixture = await legacyInstallation(source);
  try {
    const before = fixture.snapshot(),
      manifest = await stageLegacyInstallation(source, target, {
        quiesced: true,
      });
    expect(fixture.snapshot()).toEqual(before);
    expect(manifest.installation).toMatchObject({
      onboarding: 1,
      calendars: 1,
      privateFiles: 5,
    });
    expect(manifest.unhandled).toEqual([]);
    const files = await readdir(target);
    expect(files).not.toContain("external-env.json");
    expect(
      JSON.parse(
        await readFile(
          join(target, "legacy-files", "external-env.json"),
          "utf8",
        ),
      ),
    ).toEqual({ path: "/synthetic/external/never-read.env", distro: "Ubuntu" });
    expect(
      await readFile(join(target, "providers.next.json"), "utf8"),
    ).not.toContain("synthetic-preserved-provider-secret");
    expect(
      await fileConnections(
        join(target, "providers.next.json"),
        fileVault(join(target, "providers.next.json.key")),
      ).read(),
    ).toEqual(fixture.connections);
    const connection = sqliteConnection(join(target, "cadence-next.sqlite"));
    try {
      expect(
        (await new SqliteWorkspaces(connection).find(fixture.original.owner))
          ?.onboarding,
      ).toEqual(fixture.onboarding);
      const repository = new SqliteCalendar(connection),
        record = await repository.find(fixture.original.owner),
        vault = fileVault(
          join(target, "calendar.next.key"),
          "cadence.calendar/v1",
        );
      expect(record?.events).toEqual([fixture.event]);
      expect(JSON.parse(await vault.open(record!.tokens!))).toEqual(
        fixture.tokens,
      );
      expect(await vault.open(record!.authorization!.verifier)).toBe(
        fixture.verifier,
      );
      let exchanged = 0;
      const service = calendar({
        repository,
        vault,
        google: {
          clientId: "synthetic-client",
          clientSecret: "synthetic-secret",
        },
        origin: "http://127.0.0.1:9915",
        protection: "file",
        clock: Date.now,
        nonce: () => crypto.randomUUID(),
        pause: async () => {},
        transport: async (address, options) => {
          expect(String(address)).toBe("https://oauth2.googleapis.com/token");
          const form = new URLSearchParams(String(options?.body));
          expect(form.get("code_verifier")).toBe(fixture.verifier);
          exchanged++;
          return Response.json({
            access_token: "synthetic-refreshed",
            refresh_token: "synthetic-calendar-refresh",
            expires_in: 3600,
          });
        },
      });
      try {
        expect(
          await service.callback(null, {
            state: fixture.state,
            code: "synthetic-code",
          }),
        ).toMatchObject({ result: "connected" });
        expect(
          await service
            .callback(null, { state: fixture.state, code: "synthetic-code" })
            .catch((error) => error),
        ).toMatchObject({ code: "calendar_state" });
        expect(exchanged).toBe(1);
      } finally {
        await service.close();
      }
    } finally {
      connection.close();
    }
  } finally {
    fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("installation staging requires quiescence and refuses unknown databases before creating a target", async () => {
  const directory = await mkdtemp(
      join(tmpdir(), "cadence-installation-guard-"),
    ),
    source = join(directory, "legacy"),
    fixture = await legacyInstallation(source);
  try {
    expect(
      await stageLegacyInstallation(source, join(directory, "first"), {
        quiesced: false,
      }).catch((error) => error),
    ).toMatchObject({
      message:
        "Stop legacy application writes before staging the complete installation",
    });
    await writeFile(
      join(source, "unknown.sqlite"),
      "Synthetic unknown database",
    );
    expect(
      await stageLegacyInstallation(source, join(directory, "second"), {
        quiesced: true,
      }).catch((error) => error),
    ).toMatchObject({
      message: "Unknown legacy database requires migration review",
    });
    expect(await readdir(directory)).toEqual(["legacy"]);
  } finally {
    fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
