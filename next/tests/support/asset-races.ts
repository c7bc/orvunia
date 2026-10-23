import { expect, test } from "bun:test";
import type { ObjectStore } from "../../packages/assets/domain.ts";
import type { AssetService } from "../../packages/assets/service.ts";
import type { SessionRepository } from "../../packages/sessions/repository.ts";
type Environment = {
  service: AssetService;
  objects: ObjectStore;
  sessions: SessionRepository;
  workspaceId: string;
  id: string;
  input: {
    data: Uint8Array;
    mime: string;
    title: string;
    time: string;
    requestKey: string;
  };
};
export function assetRaceCases(
  name: string,
  environment: () => Promise<Environment>,
) {
  test(`${name}: an upload delayed until after deletion cannot recreate private image bytes`, async () => {
    const env = await environment(),
      original = env.objects.put.bind(env.objects);
    let entered: () => void = () => {},
      release: () => void = () => {},
      key = "";
    const started = new Promise<void>((resolve) => {
        entered = resolve;
      }),
      waiting = new Promise<void>((resolve) => {
        release = resolve;
      });
    env.objects.put = async (...arguments_) => {
      key = arguments_[0];
      entered();
      await waiting;
      await original(...arguments_);
    };
    const pending = env.service
      .upload(env.workspaceId, env.id, env.input)
      .catch((error) => error);
    await started;
    await env.sessions.remove(env.workspaceId, env.id);
    await env.service.reconcile();
    release();
    expect(await pending).toBeInstanceOf(Error);
    expect(
      await env.objects.get(key, 100).catch((error) => error),
    ).toBeInstanceOf(Error);
    expect(
      await original(key, env.input.data, env.input.mime).catch(
        (error) => error,
      ),
    ).toBeInstanceOf(Error);
    expect(await env.service.reconcile()).toBe(0);
  });
}
