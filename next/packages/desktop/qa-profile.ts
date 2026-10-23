import { join } from "node:path";
import {
  lstatSync,
  openSync,
  fstatSync,
  readSync,
  closeSync,
  constants,
} from "node:fs";
import { candidateArguments } from "./candidate-paths.ts";
import type { DesktopLaunch } from "./integrated-release.ts";
export function isolatedIntegratedProfile(options: {
  requested: string | undefined;
  background: boolean;
  launch: DesktopLaunch | null;
  installedProfile: string;
}) {
  if (!options.requested) return options.launch;
  if (!options.background || options.launch?.kind !== "integrated")
    throw Error(
      "An isolated integrated test profile requires a packaged background smoke release",
    );
  const candidate = candidateArguments(
    [
      `--candidate-runtime=${options.launch.directory}`,
      `--candidate-profile=${options.requested}`,
    ],
    options.installedProfile,
  )!;
  const filename = join(candidate.profile, "isolated-qa-profile.json"),
    initial = lstatSync(filename);
  if (!initial.isFile() || initial.isSymbolicLink() || initial.size > 2048)
    throw Error("Invalid isolated smoke profile marker");
  const handle = openSync(
    filename,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  let marker: unknown;
  try {
    const current = fstatSync(handle);
    if (
      current.dev !== initial.dev ||
      current.ino !== initial.ino ||
      current.size > 2048
    )
      throw Error("Invalid isolated smoke profile marker");
    const bytes = Buffer.alloc(2049),
      count = readSync(handle, bytes, 0, bytes.length, 0);
    if (count > 2048) throw Error("Invalid isolated smoke profile marker");
    marker = JSON.parse(bytes.subarray(0, count).toString("utf8"));
  } finally {
    closeSync(handle);
  }
  if (
    !marker ||
    typeof marker !== "object" ||
    Array.isArray(marker) ||
    (marker as Record<string, unknown>).format !==
      "cadence-isolated-profile/1" ||
    Object.keys(marker).length !== 1
  )
    throw Error(
      "The integrated smoke profile is not marked for isolated verification",
    );
  return { ...options.launch, profile: candidate.profile };
}
