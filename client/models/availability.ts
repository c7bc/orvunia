import type { CatalogModel, ModelSnapshot } from "./domain.js";
import { currentModelInstallation } from "./selection.js";
import { activeJob } from "./domain.js";

export function visibleModelCatalog(snapshot: ModelSnapshot): CatalogModel[] {
  return snapshot.catalog.filter(model => {
    if (model.availability !== "retired") return true;
    const { installation, job } = currentModelInstallation(snapshot, model);
    return Boolean(installation || (job && activeJob(job)));
  });
}

export function modelForAction(snapshot: ModelSnapshot, target: string) {
  const installation = snapshot.installations.find(item => item.id === target);
  const job = snapshot.jobs.find(item => item.id === target);
  const id = installation?.catalogId ?? job?.catalogId ?? target;
  const revision = installation?.catalogRevision ?? job?.catalogRevision;
  return snapshot.catalog.find(model => model.id === id && (!revision || model.revision === revision));
}
