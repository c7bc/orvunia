import type { CatalogModel, ModelSnapshot } from "./domain.js";

export function currentModelInstallation(snapshot: ModelSnapshot, model: CatalogModel) {
  const installation = snapshot.installations.findLast((item) =>
    item.catalogId === model.id && item.catalogRevision === model.revision && item.state !== "deleted");
  const job = snapshot.jobs.findLast((item) => {
    if (item.catalogId !== model.id || item.catalogRevision !== model.revision) return false;
    const owner = snapshot.installations.find((entry) => entry.id === item.installationId);
    if (owner?.state === "deleted") return false;
    if (installation && item.installationId !== installation.id) return false;
    return item.state !== "installed" || installation?.state === "installed";
  });
  return { installation, job };
}
