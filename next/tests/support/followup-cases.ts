import { followupRecoveryCases } from "./followup-recovery.ts";
import { expect, test } from "bun:test";
import { followupEnvironment } from "./followup-environment.ts";
import type { FollowupFixture } from "./followup-environment.ts";
import { followups } from "../../packages/followups/service.ts";
import { notificationDelivery } from "../../packages/notifications/deliver.ts";
import { DeliveryError } from "../../packages/notifications/domain.ts";
export function followupCases(name: string, fixture: FollowupFixture) {
  const environment = () => followupEnvironment(fixture);
  test(`${name}: drafts use compare-and-swap and enforce ownership`, async () => {
    const env = await environment();
    expect(
      await env.service
        .get(crypto.randomUUID(), env.session.id)
        .catch((error) => error),
    ).toMatchObject({ code: "conversation_not_found" });
    const saves = await Promise.allSettled([
      env.save(),
      env.replica().save(env.owner, env.session.id, env.input),
    ]);
    expect(saves.filter((value) => value.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(saves.filter((value) => value.status === "rejected")).toHaveLength(
      1,
    );
    const draft = (await env.status()).draft!;
    expect(
      (
        await env.service.save(env.owner, env.session.id, {
          ...env.input,
          expectedRevision: 1,
        })
      ).draft,
    ).toEqual(draft);
    const disabled = followups({
      ...env.dependencies,
      settings: { ...env.dependencies.settings, enabled: false },
    });
    expect(
      await disabled
        .send(
          env.owner,
          env.session.id,
          { revision: 1, requestId: crypto.randomUUID() },
          "en",
        )
        .catch((error) => error),
    ).toMatchObject({ code: "followup_disabled" });
  });
  test(`${name}: concurrent requests and a new request for the same revision send once`, async () => {
    const env = await environment();
    await env.save();
    const requestId = crypto.randomUUID();
    const results = await Promise.all([
      env.send(1, requestId),
      env
        .replica()
        .send(env.owner, env.session.id, { revision: 1, requestId }, "en"),
      env.send(),
    ]);
    expect(new Set(results.map((value) => value.delivery!.id)).size).toBe(1);
    expect(results.filter((value) => !value.repeated)).toHaveLength(1);
    let sent = 0;
    const deliver = notificationDelivery(env.outbox, {
      async send(_id, email) {
        sent++;
        expect(email.text).toBe(env.input.body);
        expect(email.html).toContain("&lt;script&gt;");
        expect(email.html).not.toContain("<script>");
        return { providerId: "synthetic-provider" };
      },
    });
    const id = results[0]!.delivery!.id;
    await Promise.all([deliver(id, false), deliver(id, false)]);
    expect(sent).toBe(1);
    expect((await env.status()).delivery).toMatchObject({
      status: "accepted",
      messageId: "synthetic-provider",
    });
    await env.service.save(env.owner, env.session.id, {
      ...env.input,
      subject: "Edited",
      expectedRevision: 1,
    });
    expect((await env.send(1, requestId)).repeated).toBe(true);
    const other = await env.create();
    expect(
      await env.service
        .send(env.owner, other.id, { revision: 1, requestId }, "en")
        .catch((error) => error),
    ).toMatchObject({ code: "followup_conflict" });
    expect(JSON.stringify(await env.status())).not.toContain("ciphertext");
    expect(
      (await env.repository.receipt(env.owner, requestId))!.ciphertext,
    ).toBe("");
  });
  followupRecoveryCases(name, fixture);
}
