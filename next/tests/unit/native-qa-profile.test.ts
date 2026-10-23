import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isolatedIntegratedProfile } from "../../packages/desktop/qa-profile.ts";
test("integrated smoke profile hook requires a real isolated marked directory and never accepts the installed profile, foreground or candidate mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-qa-profile-")),
    installed = join(root, "installed"),
    profile = join(root, "qa"),
    runtime = join(root, "runtime");
  try {
    await Promise.all([mkdir(installed), mkdir(profile), mkdir(runtime)]);
    const launch = {
        kind: "integrated" as const,
        directory: runtime,
        profile: installed,
      },
      options = {
        requested: profile,
        background: true,
        launch,
        installedProfile: installed,
      };
    expect(() => isolatedIntegratedProfile(options)).toThrow();
    await writeFile(
      join(profile, "isolated-qa-profile.json"),
      '{"format":"cadence-isolated-profile/1"}',
    );
    expect(isolatedIntegratedProfile(options)).toEqual({ ...launch, profile });
    expect(() =>
      isolatedIntegratedProfile({ ...options, background: false }),
    ).toThrow("background");
    expect(() =>
      isolatedIntegratedProfile({ ...options, requested: installed }),
    ).toThrow("installed");
    expect(() =>
      isolatedIntegratedProfile({
        ...options,
        launch: { ...launch, kind: "candidate" },
      }),
    ).toThrow("background");
    expect(() =>
      isolatedIntegratedProfile({ ...options, requested: runtime }),
    ).toThrow("overlap");
    await writeFile(
      join(profile, "isolated-qa-profile.json"),
      '{"format":"cadence-isolated-profile/1","extra":true}',
    );
    expect(() => isolatedIntegratedProfile(options)).toThrow("marked");
    expect(
      isolatedIntegratedProfile({ ...options, requested: undefined }),
    ).toBe(launch);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
