import { expect, test } from "bun:test";
import { assetRaceCases } from "./asset-races.ts";
import { assets } from "../../packages/assets/service.ts";
import type { AssetRepository } from "../../packages/assets/repository.ts";
import type { ObjectStore } from "../../packages/assets/domain.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";

type Fixture = () => Promise<{
  repository: AssetRepository;
  objects: ObjectStore;
  sessions: SessionRepository;
}>;
const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]);
export function assetCases(name: string, fixture: Fixture) {
  async function environment(maximumBytes = 1024) {
    const storage = await fixture(),
      workspaceId = crypto.randomUUID();
    let now = Date.now();
    const conversation = await storage.sessions.create({
      id: crypto.randomUUID(),
      workspaceId,
      title: "Private images",
      mode: "technical",
      state: "active",
      createdAt: new Date().toISOString(),
      modeSnapshot: null,
      elapsed: 0,
      question: "",
      historyGeneration: 0,
      revision: 0,
    });
    const input = {
      data: image,
      mime: "image/png",
      title: "Synthetic",
      time: "00:01",
      requestKey: crypto.randomUUID(),
    };
    const service = assets({
      ...storage,
      identifier: () => crypto.randomUUID(),
      clock: () => now,
      maximumBytes,
    });
    return {
      ...storage,
      service,
      workspaceId,
      id: conversation.id,
      input,
      advance: () => {
        now += 11 * 60_000;
      },
    };
  }
  assetRaceCases(name, environment);
  test(`${name}: private captures replay one identity and reject key reuse with another payload`, async () => {
    const { service, workspaceId, id, input, sessions } = await environment();
    const saved = await service.upload(workspaceId, id, input);
    expect(await service.upload(workspaceId, id, input)).toEqual(saved);
    expect((await sessions.counts(workspaceId, id)).captures).toBe(1);
    const content = await service.download(workspaceId, id, saved.id);
    expect(content.data).toEqual(image);
    await expect(
      service.upload(workspaceId, id, {
        ...input,
        data: new Uint8Array([...image, 2]),
      }),
    ).rejects.toMatchObject({ code: "request_conflict" });
    await expect(
      service.download(crypto.randomUUID(), id, saved.id),
    ).rejects.toMatchObject({ code: "asset_not_found" });
  });
  test(`${name}: concurrent uploads cannot exceed the workspace byte quota`, async () => {
    const { service, workspaceId, id, input, sessions } = await environment(
      image.byteLength,
    );
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        service.upload(workspaceId, id, {
          ...input,
          requestKey: crypto.randomUUID(),
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect((await sessions.counts(workspaceId, id)).captures).toBe(1);
  });
  test(`${name}: failed publication can retry and session deletion durably cleans private objects`, async () => {
    const {
      repository,
      objects,
      sessions,
      workspaceId,
      id,
      input,
      advance,
      service,
    } = await environment();
    let fail = true;
    const interrupted = assets({
      repository,
      objects: {
        ...objects,
        put: async (...args) => {
          await objects.put(...args);
          if (fail) {
            fail = false;
            throw Error("Synthetic lost object acknowledgement");
          }
        },
      },
      identifier: () => crypto.randomUUID(),
      clock: () => Date.now(),
      maximumBytes: 1024,
    });
    await expect(interrupted.upload(workspaceId, id, input)).rejects.toThrow(
      "lost object",
    );
    const saved = await interrupted.upload(workspaceId, id, input);
    const asset = await repository.find(workspaceId, id, saved.id);
    expect(asset?.state).toBe("ready");
    if (!asset) throw Error("Asset missing");
    await sessions.remove(workspaceId, id);
    await expect(
      service.download(workspaceId, id, saved.id),
    ).rejects.toMatchObject({ code: "asset_not_found" });
    advance();
    expect(await service.reconcile()).toBeGreaterThanOrEqual(1);
    await expect(objects.get(asset.objectKey, 100)).rejects.toBeDefined();
    expect(await service.reconcile()).toBe(0);
  });
  test(`${name}: deleting a capture invalidates cursors and stale upload retries cannot recreate it`, async () => {
    const { service, repository, workspaceId, id, input, sessions } =
      await environment();
    const saved = await service.upload(workspaceId, id, input);
    await service.remove(workspaceId, id, saved.id);
    expect((await sessions.find(workspaceId, id))?.historyGeneration).toBe(1);
    await service.reconcile();
    expect((await repository.find(workspaceId, id, saved.id))?.state).toBe(
      "deleted",
    );
    await expect(service.upload(workspaceId, id, input)).rejects.toMatchObject({
      code: "request_conflict",
    });
  });
}
