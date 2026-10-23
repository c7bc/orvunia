import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  access,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prepareRuntimeProfile } from "../../packages/desktop/runtime-profile.ts";
import { selectDesktopLaunch } from "../../packages/desktop/integrated-release.ts";

test("integrated identity requires the instance lock, initializes a nonempty legacy profile without touching its existing files and persists across restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-runtime-profile-")),
    profile = join(root, "profile"),
    noLock = join(root, "unowned");
  try {
    expect(() =>
      prepareRuntimeProfile({ directory: noLock, ownsLock: false }),
    ).toThrow("exclusive");
    await expect(access(noLock)).rejects.toThrow();
    await mkdir(join(profile, "data"), { recursive: true });
    await writeFile(
      join(profile, "data/cadence.sqlite"),
      "synthetic preserved original",
    );
    await writeFile(join(profile, "desktop.json"), '{"uiLocale":"en"}');
    const first = prepareRuntimeProfile({ directory: profile, ownsLock: true });
    expect(first.format).toBe("cadence-desktop-runtime/1");
    expect(first.token).toHaveLength(43);
    expect(
      prepareRuntimeProfile({ directory: profile, ownsLock: true }),
    ).toEqual(first);
    expect(await readFile(join(profile, "data/cadence.sqlite"), "utf8")).toBe(
      "synthetic preserved original",
    );
    expect(await readFile(join(profile, "desktop.json"), "utf8")).toBe(
      '{"uiLocale":"en"}',
    );
    expect((await readdir(profile)).sort()).toEqual([
      "data",
      "desktop.json",
      "runtime-profile.json",
    ]);
    await writeFile(
      join(profile, "runtime-profile.json"),
      '{"token":"synthetic malformed identity"}',
    );
    expect(() =>
      prepareRuntimeProfile({ directory: profile, ownsLock: true }),
    ).toThrow("metadata");
    expect(
      await readFile(join(profile, "runtime-profile.json"), "utf8"),
    ).toContain("synthetic malformed identity");
    expect(() =>
      prepareRuntimeProfile({ directory: "relative", ownsLock: true }),
    ).toThrow("absolute");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("concurrent synthetic identity preparation publishes exactly one complete private identity", async () => {
  const profile = await mkdtemp(
    join(tmpdir(), "cadence-runtime-identity-race-"),
  );
  try {
    const module = new URL(
      "../../packages/desktop/runtime-profile.ts",
      import.meta.url,
    ).href;
    const script = `import {prepareRuntimeProfile} from ${JSON.stringify(module)};console.log(JSON.stringify(prepareRuntimeProfile({directory:${JSON.stringify(profile)},ownsLock:true})));`;
    const processes = [0, 1, 2].map(() =>
      Bun.spawn([process.execPath, "--eval", script], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      }),
    );
    const results = await Promise.all(
      processes.map(async (child) => {
        const output = new Response(child.stdout).text();
        const diagnostics = new Response(child.stderr).text();
        if ((await child.exited) !== 0) throw Error(await diagnostics);
        return JSON.parse(await output) as unknown;
      }),
    );
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(await readdir(profile)).toEqual(["runtime-profile.json"]);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
});

test("release metadata enables Bun for installed profiles only in an explicitly packaged generation; baseline and explicit candidate remain separate", () => {
  const root = join(tmpdir(), "cadence-release-selection"),
    profile = join(root, "profile"),
    resources = join(root, "resources");
  const options = {
    candidate: null,
    installedProfile: profile,
    resources,
    packaged: true,
    metadata: { version: "5.0.0" },
  };
  expect(selectDesktopLaunch(options)).toBeNull();
  const metadata = {
    cadenceDesktop: {
      format: "cadence-desktop-release/1",
      runtime: "bun",
      channel: "integrated",
    },
  };
  expect(selectDesktopLaunch({ ...options, metadata })).toEqual({
    kind: "integrated",
    directory: join(resources, "cadence-runtime"),
    profile,
  });
  expect(() =>
    selectDesktopLaunch({ ...options, packaged: false, metadata }),
  ).toThrow("packaged");
  expect(() =>
    selectDesktopLaunch({
      ...options,
      metadata: {
        cadenceDesktop: { ...metadata.cadenceDesktop, runtime: "unknown" },
      },
    }),
  ).toThrow("Unsupported");
  expect(() =>
    selectDesktopLaunch({ ...options, installedProfile: resources, metadata }),
  ).toThrow("separate");
  const candidate = {
    directory: join(root, "candidate-runtime"),
    profile: join(root, "candidate-profile"),
  };
  expect(selectDesktopLaunch({ ...options, candidate, metadata })).toEqual({
    ...candidate,
    kind: "candidate",
  });
});
