import { expect, test } from "bun:test";
import { CuratedCatalog } from "../../packages/local-models/catalog.ts";
import { importNativeModel } from "../../packages/desktop/model-import.ts";
import type { NativeContext } from "../../packages/desktop/application-types.ts";
import type { PlatformInvocation } from "../../packages/desktop/platform-types.ts";
import { syntheticManifest } from "../support/local-models.ts";

test("unqualified revisions remain resolvable for history but are not offered for acquisition", () => {
  const catalog = new CuratedCatalog();
  expect(catalog.list()).toHaveLength(7);
  expect(catalog.listAvailable()).toEqual([]);
  expect(catalog.listVisible([])).toEqual([]);
  for (const model of catalog.list()) {
    expect(model.availability).toBe("retired");
    expect(catalog.find(model.id, model.revision).files).toEqual(model.files);
    expect(() => catalog.acquire(model.id, model.revision)).toThrow("model_retired");
  }
  const candidate = syntheticManifest();
  const independent = new CuratedCatalog([candidate]);
  expect(independent.listAvailable("text")).toEqual([candidate]);
  expect(independent.listAvailable("vision")).toEqual([]);
});

test("retired metadata is visible only for matching live installations or pending jobs", () => {
  const catalog = new CuratedCatalog();
  const model = catalog.list()[0]!;
  const reference = { catalogId: model.id, catalogRevision: model.revision, state: "installed" as const };
  expect(catalog.listVisible([reference])).toEqual([model]);
  expect(catalog.listVisible([{ ...reference, state: "deleted" }])).toEqual([]);
  expect(catalog.listVisible([{ ...reference, catalogRevision: "a".repeat(40) }])).toEqual([]);
  expect(catalog.listVisible([{ ...reference, state: "failed-cleanup" }])).toEqual([model]);
  expect(catalog.listVisible([], [{ ...reference, state: "queued" }])).toEqual([model]);
  expect(catalog.listVisible([], [{ ...reference, state: "failed" }])).toEqual([]);
  const visible = catalog.listVisible([reference]);
  visible[0]!.files[0]!.bytes = 1;
  expect(catalog.find(model.id, model.revision).files).toEqual(model.files);
});

test("native import rejects a retired revision before opening a file picker", async () => {
  const model = new CuratedCatalog().list()[0]!;
  let dialogs = 0, validations = 0;
  const context = { deployment: "local", identity: { token: "synthetic" }, electron: {
    dialog: { async showOpenDialog() { dialogs++; throw Error("Must not open"); } },
  } } as unknown as NativeContext;
  await expect(importNativeModel(context, {} as PlatformInvocation,
    { requestId: crypto.randomUUID(), catalogId: model.id, revision: model.revision }, () => { validations++; }))
    .rejects.toThrow("model_retired");
  expect(dialogs).toBe(0);
  expect(validations).toBe(1);
});
