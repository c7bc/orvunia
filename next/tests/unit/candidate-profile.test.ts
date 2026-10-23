import { expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { candidateArguments } from "../../packages/desktop/candidate-paths.ts";
import { prepareCandidateProfile } from "../../packages/desktop/candidate-profile.ts";

test("candidate arguments require both absolute paths and cannot overlap the installed profile or runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-candidate-options-")),
    runtime = join(root, "runtime"),
    installed = join(root, "installed"),
    profile = join(root, "candidate");
  await mkdir(runtime);
  await mkdir(installed);
  const args = [
    `--candidate-runtime=${runtime}`,
    `--candidate-profile=${profile}`,
  ];
  try {
    expect(candidateArguments([], installed)).toBeNull();
    expect(candidateArguments(args, installed)).toEqual({
      directory: runtime,
      profile,
    });
    for (const values of [
      [args[0]!],
      [args[1]!],
      [...args, args[0]!],
      ["--candidate-runtime", args[1]!],
      [...args, "--candidate-unknown=value"],
      ["--candidate-runtime=relative", args[1]!],
      [args[0]!, `--candidate-profile=${installed}`],
      [args[0]!, `--candidate-profile=${join(installed, "nested")}`],
      [args[0]!, `--candidate-profile=${root}`],
      [args[0]!, `--candidate-profile=${join(runtime, "nested")}`],
    ])
      expect(() => candidateArguments(values, installed)).toThrow();
    expect(await readdir(installed)).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a prepared candidate retains its private identity and refuses an unmarked or corrupted existing profile", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-candidate-profile-")),
    profile = join(root, "new"),
    unmarked = join(root, "unmarked");
  try {
    const first = prepareCandidateProfile(profile);
    await mkdir(join(profile, "data"));
    await writeFile(
      join(profile, "data/private.sqlite"),
      "preserved synthetic data",
    );
    expect(prepareCandidateProfile(profile)).toEqual(first);
    await mkdir(unmarked);
    await writeFile(
      join(unmarked, "private.sqlite"),
      "unrelated original data",
    );
    expect(() => prepareCandidateProfile(unmarked)).toThrow(
      "empty or previously prepared",
    );
    expect(await readdir(unmarked)).toEqual(["private.sqlite"]);
    await writeFile(
      join(profile, "candidate-profile.json"),
      "invalid-private-metadata",
    );
    expect(() => prepareCandidateProfile(profile)).toThrow(
      "metadata is invalid",
    );
    expect(await readFile(join(profile, "data/private.sqlite"), "utf8")).toBe(
      "preserved synthetic data",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
