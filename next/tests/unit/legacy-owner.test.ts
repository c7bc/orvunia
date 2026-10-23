import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { legacyDesktopOwner } from "../../packages/desktop/legacy-owner.ts";
test("native owner selection prefers the data-directory cookie without sending its value to another origin", async () => {
  const owner = crypto.randomUUID(),
    other = crypto.randomUUID();
  const directory = "/synthetic/legacy/data",
    origin = "http://127.0.0.1:8790";
  const expected = `cadence_owner_${createHash("sha256").update(directory).digest("hex").slice(0, 12)}`;
  const calls: { name: string; url: string }[] = [];
  const cookies = {
    async get(options: { name: string; url: string }) {
      calls.push(options);
      return [{ value: options.name === expected ? owner : other }];
    },
  };
  expect(await legacyDesktopOwner(cookies, directory, origin)).toBe(owner);
  expect(calls).toEqual([{ name: expected, url: origin }]);
});
test("native owner selection supports the original cookie but never hides malformed or ambiguous saved identity", async () => {
  const owner = crypto.randomUUID();
  const cookies = {
    async get({ name }: { name: string; url: string }) {
      return name === "cadence_owner" ? [{ value: owner }] : [];
    },
  };
  expect(
    await legacyDesktopOwner(
      cookies,
      "/synthetic/data",
      "http://127.0.0.1:8790",
    ),
  ).toBe(owner);
  expect(
    await legacyDesktopOwner(
      { get: async () => [] },
      "/synthetic/data",
      "http://127.0.0.1:8790",
    ),
  ).toBeUndefined();
  for (const values of [
    [{ value: "invalid-private-cookie" }],
    [{ value: owner }, { value: owner }],
  ])
    await expect(
      legacyDesktopOwner(
        { get: async () => values },
        "/synthetic/data",
        "http://127.0.0.1:8790",
      ),
    ).rejects.toThrow("credential is invalid");
});
