import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { legacyInstallation } from "../support/legacy-installation.ts";
import { prepareCandidateProfile } from "../../packages/desktop/candidate-profile.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
const executable = process.env.CADENCE_TEST_ELECTRON,
  runtime = process.env.CADENCE_TEST_RUNTIME_PACKAGE;
if (process.platform === "win32" && executable && runtime)
  for (const imported of [false, true])
    test(`complete native entrypoint ${imported ? "migrates a synthetic legacy installation" : "initializes a fresh profile"} using packaged Bun without displaying windows, shortcuts or a tray`, async () => {
      const directory = await mkdtemp(join(tmpdir(), "cadence-native-main-")),
        profile = join(directory, "profile"),
        output = join(directory, "verification");
      const root = fileURLToPath(new URL("../../../", import.meta.url));
      prepareCandidateProfile(profile);
      const fixture = imported
        ? await legacyInstallation(join(profile, "data"))
        : null;
      const original = fixture?.snapshot();
      let child: Bun.Subprocess<"ignore", "pipe", "pipe"> | null = null;
      let succeeded = false,
        termination: Promise<void> | null = null;
      const terminate = () => {
        if (!child || child.exitCode !== null) return Promise.resolve();
        const owned = child;
        termination ??= promisify(execFile)(
          "taskkill.exe",
          ["/PID", String(owned.pid), "/T", "/F"],
          { windowsHide: true, timeout: 10000 },
        ).then(async () => {
          await owned.exited;
        });
        return termination;
      };
      try {
        child = Bun.spawn(
          [
            executable,
            process.env.CADENCE_TEST_NATIVE_MAIN || root,
            "--smoke-background",
            `--candidate-runtime=${runtime}`,
            `--candidate-profile=${profile}`,
          ],
          {
            cwd: root,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
            env: {
              PATH: process.env.PATH,
              SystemRoot: process.env.SystemRoot,
              CADENCE_TEST_OUTPUT_DIR: output,
              CADENCE_TEST_NATIVE_TRACE: join(directory, "trace.jsonl"),
              CADENCE_TEST_SHUTDOWN_FIXTURE: "1",
            },
          },
        );
        const diagnostics = new Response(child.stderr).text(),
          logs = new Response(child.stdout).text();
        const timer = setTimeout(() => {
          void terminate().catch(() => {});
        }, 40000);
        try {
          const status = await child.exited;
          if (status !== 0)
            throw Error(
              (await readFile(join(profile, "smoke-error.txt"), "utf8").catch(
                () => diagnostics,
              )) +
                "\n" +
                (await readFile(join(directory, "trace.jsonl"), "utf8").catch(
                  () => "No trace available",
                )),
            );
          expect(status).toBe(0);
        } finally {
          clearTimeout(timer);
        }
        const report = JSON.parse(
          await readFile(join(output, "desktop-smoke.json"), "utf8"),
        );
        expect(report.background).toMatchObject({
          enabled: true,
          visibleWindows: 0,
          focusedWindows: 0,
          focusableWindows: 0,
          registeredShortcuts: 0,
          trayCreated: false,
          desktopCaptureSkipped: true,
        });
        expect(report.keyConfigured).toBe(imported);
        expect(report.contextIsolation).toBe(true);
        expect(report.sandbox).toBe(true);
        expect(
          JSON.parse(
            await readFile(join(output, "desktop-shutdown.json"), "utf8"),
          ),
        ).toEqual({ requested: 3, saved: 3, pending: 0 });
        const pointer = JSON.parse(
          await readFile(join(profile, "backend-active.json"), "utf8"),
        );
        await access(
          join(
            profile,
            "backend-data",
            pointer.directory,
            "cadence-next.sqlite",
          ),
        );
        const shutdownDatabase = sqliteConnection(
          join(
            profile,
            "backend-data",
            pointer.directory,
            "cadence-next.sqlite",
          ),
        );
        try {
          expect(
            shutdownDatabase.client
              .query("SELECT title FROM next_conversations WHERE id=?")
              .get(report.shutdownSession),
          ).toMatchObject({ title: "Synthetic shutdown saved title" });
          expect(
            shutdownDatabase.client
              .query("SELECT text FROM next_notes WHERE conversation_id=?")
              .get(report.shutdownSession),
          ).toMatchObject({ text: "Synthetic shutdown saved notes" });
        } finally {
          shutdownDatabase.close();
        }
        if (fixture) {
          expect(fixture.snapshot()).toEqual(original!);
          expect(pointer.workspaceId).toBe(fixture.original.owner);
          const connection = sqliteConnection(
            join(
              profile,
              "backend-data",
              pointer.directory,
              "cadence-next.sqlite",
            ),
          );
          try {
            expect(
              connection.client
                .query("SELECT title FROM next_conversations WHERE id=?")
                .get(fixture.original.session),
            ).toMatchObject({ title: "Conversa preservada" });
          } finally {
            connection.close();
          }
          expect(
            await readFile(
              join(
                profile,
                "backend-data",
                pointer.directory,
                "providers.next.json",
              ),
              "utf8",
            ),
          ).not.toContain("synthetic-preserved-provider-secret");
        } else
          await expect(
            access(join(profile, "data/cadence.sqlite")),
          ).rejects.toThrow();
        expect(await diagnostics).not.toContain(
          "Candidate profile metadata is invalid",
        );
        await logs;
        succeeded = true;
      } finally {
        await terminate();
        fixture?.close();
        if (succeeded) await rm(directory, { recursive: true, force: true });
      }
    }, 45000);
