import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { workspaceScopedIdentity } from "../../packages/identity/workspace-scope.ts";
test("a workspace hint can only constrain the authenticated identity, never select a different owner", async () => {
  const principal = {
    userId: crypto.randomUUID(),
    workspaceId: crypto.randomUUID(),
    locale: "en" as const,
  };
  const identity = workspaceScopedIdentity({ resolve: async () => principal });
  const scope = createHash("sha256")
    .update(principal.workspaceId)
    .digest("hex")
    .slice(0, 24);
  const request = (hint?: string) =>
    new Request("http://127.0.0.1:9915/api/import", {
      headers: hint ? { "x-cadence-workspace": hint } : {},
    });
  expect(await identity.resolve(request())).toEqual(principal);
  expect(await identity.resolve(request(scope))).toEqual(principal);
  await expect(identity.resolve(request("f".repeat(24)))).rejects.toMatchObject(
    { code: "workspace_conflict", status: 409 },
  );
  await expect(identity.resolve(request("malformed"))).rejects.toMatchObject({
    code: "invalid_input",
    status: 400,
  });
  expect(
    await workspaceScopedIdentity({ resolve: async () => null }).resolve(
      request(scope),
    ),
  ).toBeNull();
});
