import { lstatSync } from "node:fs";
import { join } from "node:path";

const desktopMarkers = [
  "desktop.json",
  "backend-active.json",
  "candidate-profile.json",
  "browser-storage-origin.json",
  "Local State",
  "Local Storage",
  "Session Storage",
  "Partitions",
];
const applicationMarkers = [
  "package.json",
  "bun.lock",
  "pnpm-lock.yaml",
  "package-lock.json",
  "app.asar",
  "resources/app.asar",
];
function present(filename: string) {
  try {
    lstatSync(filename);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return false;
    throw Error("Personal profile directory cannot be inspected");
  }
}
export function assertPersonalDirectory(directory: string) {
  if (desktopMarkers.some((marker) => present(join(directory, marker))))
    throw Error("Personal browser startup cannot use a desktop profile");
  if (applicationMarkers.some((marker) => present(join(directory, marker))))
    throw Error(
      "Personal browser startup requires a data directory outside the application files",
    );
}
