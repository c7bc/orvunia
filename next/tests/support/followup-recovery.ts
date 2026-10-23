import { expect, test } from "bun:test";
import { followupEnvironment } from "./followup-environment.ts";
import type { FollowupFixture } from "./followup-environment.ts";
import { notificationDelivery } from "../../packages/notifications/deliver.ts";
import { DeliveryError } from "../../packages/notifications/domain.ts";
export function followupRecoveryCases(name: string, fixture: FollowupFixture) {
  const environment = () => followupEnvironment(fixture);
  test(`${name}: deleting pending mail cancels delivery and processing mail blocks deletion`, async () => {
    const env = await environment();
    await env.save();
    const pending = await env.send();
    expect(await env.sessions.remove(env.owner, env.session.id)).toBe(true);
    expect(await env.outbox.claim(pending.delivery!.id)).toBeNull();
    const other = await env.create();
    await env.service.save(env.owner, other.id, env.input);
    const active = await env.service.send(
      env.owner,
      other.id,
      { revision: 1, requestId: crypto.randomUUID() },
      "en",
    );
    expect(await env.outbox.claim(active.delivery!.id)).not.toBeNull();
    expect(
      await env.sessions.remove(env.owner, other.id).catch((error) => error),
    ).toMatchObject({ code: "operation_busy" });
    await env.outbox.complete(active.delivery!.id, "synthetic");
    expect(await env.sessions.remove(env.owner, other.id)).toBe(true);
  });
  test(`${name}: deletion cannot reset the daily allowance and concurrent sends share it`, async () => {
    const env = await environment();
    env.dependencies.settings.dailyLimit = 1;
    await env.save();
    const other = await env.create();
    await env.service.save(env.owner, other.id, env.input);
    const outcomes = await Promise.allSettled([
      env.send(),
      env.service.send(
        env.owner,
        other.id,
        { revision: 1, requestId: crypto.randomUUID() },
        "en",
      ),
    ]);
    expect(
      outcomes.filter((value) => value.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((value) => value.status === "rejected"),
    ).toHaveLength(1);
    await env.sessions.remove(env.owner, env.session.id);
    await env.sessions.remove(env.owner, other.id);
    const next = await env.create();
    await env.service.save(env.owner, next.id, env.input);
    expect(
      await env.service
        .send(
          env.owner,
          next.id,
          { revision: 1, requestId: crypto.randomUUID() },
          "en",
        )
        .catch((error) => error),
    ).toMatchObject({ code: "followup_limit" });
    env.advance(86400001);
    expect(
      (
        await env.service.send(
          env.owner,
          next.id,
          { revision: 1, requestId: crypto.randomUUID() },
          "en",
        )
      ).repeated,
    ).toBe(false);
  });
  test(`${name}: unknown sends and stale process claims are never replayed`, async () => {
    const env = await environment();
    await env.save();
    const sent = await env.send();
    let attempts = 0;
    const deliver = notificationDelivery(env.outbox, {
      async send() {
        attempts++;
        throw new DeliveryError("unknown");
      },
    });
    await deliver(sent.delivery!.id, false);
    await deliver(sent.delivery!.id, false);
    expect(attempts).toBe(1);
    expect((await env.status()).delivery!.status).toBe("unconfirmed");
    await env.service.save(env.owner, env.session.id, {
      ...env.input,
      subject: "Another",
      expectedRevision: 1,
    });
    const next = await env.send(2);
    await env.outbox.claim(next.delivery!.id);
    env.advance(180001);
    await env.outbox.recover();
    expect(await env.outbox.claim(next.delivery!.id)).toBeNull();
    expect((await env.status()).delivery!.status).toBe("unconfirmed");
    env.advance(86400000);
    await env.outbox.recover();
    expect(
      (await env.repository.latest(env.owner, env.session.id))!.ciphertext,
    ).toBe("");
  });
  test(`${name}: only known rate limits retry, with a durable three-attempt bound`, async () => {
    const env = await environment();
    await env.save();
    const sent = await env.send();
    let count = 0;
    const deliver = notificationDelivery(env.outbox, {
      async send() {
        count++;
        throw new DeliveryError("retryable");
      },
    });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const outcome = deliver(sent.delivery!.id, attempt === 3).catch(
        (error) => error,
      );
      await outcome;
      env.advance(1001);
    }
    await deliver(sent.delivery!.id, false);
    expect(count).toBe(3);
    expect((await env.status()).delivery!.status).toBe("rejected");
    expect(
      (await env.repository.latest(env.owner, env.session.id))!.ciphertext,
    ).toBe("");
  });
}
