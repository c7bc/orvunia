import { existsSync, realpathSync } from "node:fs";
import {
  resolve,
  dirname,
  basename,
  relative,
  isAbsolute,
  sep,
} from "node:path";
function canonicalPath(value: string) {
  if (!isAbsolute(value))
    throw Error("Candidate runtime and profile paths must be absolute");
  const missing: string[] = [];
  let current = resolve(value);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) throw Error("Candidate path could not be resolved");
    missing.unshift(basename(current));
    current = parent;
  }
  return resolve(realpathSync(current), ...missing);
}
function overlaps(first: string, second: string) {
  const inside = (parent: string, child: string) => {
    const path = relative(parent, child);
    return (
      !path ||
      (!isAbsolute(path) && path !== ".." && !path.startsWith(".." + sep))
    );
  };
  return inside(first, second) || inside(second, first);
}
export function candidateArguments(
  arguments_: readonly string[],
  installedProfile: string,
) {
  const option = (name: string) =>
    arguments_
      .filter((value) => value.startsWith(name + "="))
      .map((value) => value.slice(name.length + 1));
  const runtime = option("--candidate-runtime"),
    profile = option("--candidate-profile");
  if (
    arguments_.filter((value) => value.startsWith("--candidate")).length !==
    runtime.length + profile.length
  )
    throw Error("Unknown or incomplete candidate launch option");
  if (!runtime.length && !profile.length) return null;
  if (
    runtime.length !== 1 ||
    profile.length !== 1 ||
    !runtime[0] ||
    !profile[0]
  )
    throw Error(
      "Candidate launch requires exactly one runtime and one isolated profile",
    );
  const directory = canonicalPath(runtime[0]),
    data = canonicalPath(profile[0]),
    installed = canonicalPath(installedProfile);
  if (overlaps(data, installed) || overlaps(data, directory))
    throw Error(
      "Candidate launch cannot use the installed profile or overlap runtime resources",
    );
  return { directory, profile: data };
}
