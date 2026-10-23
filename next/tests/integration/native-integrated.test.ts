import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  access,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { legacyInstallation } from "../support/legacy-installation.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
const executable = process.env.CADENCE_TEST_INTEGRATED_EXECUTABLE;
if (executable && process.platform === "win32")
  for (const imported of [false, true])
    test(`packaged integrated entrypoint selects Bun without candidate arguments, ${imported ? "preserves a synthetic legacy installation" : "initializes a fresh profile"}, and retains later writes across restart`, async () => {
      const directory = await mkdtemp(
          join(tmpdir(), "cadence-native-integrated-"),
        ),
        profile = join(directory, "profile"),
        output = join(directory, "verification");
      await mkdir(profile);
      await writeFile(
        join(profile, "isolated-qa-profile.json"),
        '{"format":"cadence-isolated-profile/1"}',
      );
      const fixture = imported
        ? await legacyInstallation(join(profile, "data"))
        : null;
      const original = fixture?.snapshot();
      let child: Bun.Subprocess<"ignore", "pipe", "pipe"> | null = null;
      try {
        let identity = "",
          generation = "",
          firstSession = "";
        for (const phase of ["first", "restart"]) {
          child = Bun.spawn([executable, "--smoke-background"], {
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
            env: {
              PATH: process.env.PATH,
              SystemRoot: process.env.SystemRoot,
              CADENCE_TEST_INTEGRATED_PROFILE: profile,
              CADENCE_TEST_OUTPUT_DIR: output,
              CADENCE_TEST_SHUTDOWN_FIXTURE: "1",
            },
          });
          const diagnostics = new Response(child.stderr).text(),
            logs = new Response(child.stdout).text();
          const timeout = setTimeout(() => child?.kill(), 35000);
          try {
            const status = await child.exited;
            if (status !== 0)
              throw Error(
                await readFile(join(profile, "smoke-error.txt"), "utf8").catch(
                  () => diagnostics,
                ),
              );
            expect(status).toBe(0);
            await logs;
          } finally {
            clearTimeout(timeout);
          }
          const report = JSON.parse(
            await readFile(join(output, "desktop-smoke.json"), "utf8"),
          );
          expect(report.runtimeKind).toBe("integrated");
          expect(report.background).toMatchObject({
            visibleWindows: 0,
            focusedWindows: 0,
            registeredShortcuts: 0,
            trayCreated: false,
          });
          expect(report.keyConfigured).toBe(imported);
          expect(
            JSON.parse(
              await readFile(join(output, "desktop-shutdown.json"), "utf8"),
            ),
          ).toEqual({ requested: 3, saved: 3, pending: 0 });
          const pointer = JSON.parse(
            await readFile(join(profile, "backend-active.json"), "utf8"),
          );
          const currentIdentity = await readFile(
            join(profile, "runtime-profile.json"),
            "utf8",
          );
          if (phase === "first") {
            identity = currentIdentity;
            generation = pointer.directory;
            firstSession = report.shutdownSession;
          } else {
            expect(currentIdentity).toBe(identity);
            expect(pointer.directory).toBe(generation);
          }
          await expect(
            access(join(profile, "candidate-profile.json")),
          ).rejects.toThrow();
          const connection = sqliteConnection(
            join(
              profile,
              "backend-data",
              pointer.directory,
              "cadence-next.sqlite",
            ),
          );
          try {
            for (const session of new Set([
              firstSession,
              String(report.shutdownSession),
            ])) {
              expect(
                connection.client
                  .query("SELECT title FROM next_conversations WHERE id=?")
                  .get(session),
              ).toMatchObject({ title: "Synthetic shutdown saved title" });
              expect(
                connection.client
                  .query("SELECT text FROM next_notes WHERE conversation_id=?")
                  .get(session),
              ).toMatchObject({ text: "Synthetic shutdown saved notes" });
            }
            if (fixture) {
              expect(fixture.snapshot()).toEqual(original!);
              expect(pointer.workspaceId).toBe(fixture.original.owner);
              expect(
                connection.client
                  .query("SELECT title FROM next_conversations WHERE id=?")
                  .get(fixture.original.session),
              ).toMatchObject({ title: "Conversa preservada" });
            }
          } finally {
            connection.close();
          }
        }
      } finally {
        if (child && child.exitCode === null) {
          child.kill();
          await child.exited;
        }
        fixture?.close();
        await rm(directory, { recursive: true, force: true });
      }
    }, 80000);
