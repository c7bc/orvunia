export type UpdateTarget = {
  version: string;
  platform: "win32" | "darwin" | "linux";
  arch: "x64" | "arm64";
};
export type Release = UpdateTarget & {
  url: string;
  sha256: string;
  notes: string;
  publishedAt: string;
};
export type ReleaseFeed = { schema: 1; releases: Release[] };
export type UpdateStatus = {
  status: "not-configured" | "unavailable" | "current" | "available";
  current: string;
  release?: Release;
};
function compareVersions(left: string, right: string) {
  const first = left.split(".").map(Number),
    second = right.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = first[index]! - second[index]!;
    if (difference) return difference;
  }
  return 0;
}
export function selectRelease(
  feed: ReleaseFeed,
  target: UpdateTarget,
): UpdateStatus {
  const latest = feed.releases
    .filter(
      (release) =>
        release.platform === target.platform && release.arch === target.arch,
    )
    .sort((first, second) => compareVersions(second.version, first.version))[0];
  return latest && compareVersions(latest.version, target.version) > 0
    ? { status: "available", current: target.version, release: latest }
    : { status: "current", current: target.version };
}
