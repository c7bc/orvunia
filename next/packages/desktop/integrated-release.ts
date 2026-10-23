import { join, isAbsolute, relative, sep } from "node:path";
import { z } from "zod";

const release = z
  .object({
    format: z.literal("cadence-desktop-release/1"),
    runtime: z.literal("bun"),
    channel: z.literal("integrated"),
  })
  .strict();
export type DesktopLaunch = {
  kind: "candidate" | "integrated";
  directory: string;
  profile: string;
};
function inside(parent: string, child: string) {
  const path = relative(parent, child);
  return (
    !path ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(".." + sep))
  );
}
export function selectDesktopLaunch(options: {
  candidate: { directory: string; profile: string } | null;
  installedProfile: string;
  packaged: boolean;
  resources: string;
  metadata: unknown;
}): DesktopLaunch | null {
  if (options.candidate) return { ...options.candidate, kind: "candidate" };
  if (
    !options.metadata ||
    typeof options.metadata !== "object" ||
    Array.isArray(options.metadata)
  )
    return null;
  const configured = (options.metadata as Record<string, unknown>)
    .cadenceDesktop;
  if (configured === undefined) return null;
  if (!release.safeParse(configured).success)
    throw Error("Unsupported integrated desktop release metadata");
  if (!options.packaged)
    throw Error("Integrated desktop runtime requires a packaged release");
  if (!isAbsolute(options.resources) || !isAbsolute(options.installedProfile))
    throw Error("Integrated desktop paths must be absolute");
  const directory = join(options.resources, "cadence-runtime");
  if (
    inside(directory, options.installedProfile) ||
    inside(options.installedProfile, directory)
  )
    throw Error("Integrated resources must be separate from the user profile");
  return { kind: "integrated", directory, profile: options.installedProfile };
}
