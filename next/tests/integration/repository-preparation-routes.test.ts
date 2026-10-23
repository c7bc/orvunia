import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { repositoryPreparationRoutes } from "../../apps/api/repository-preparation.ts";
import { workspaces } from "../../packages/workspaces/service.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { HttpError } from "../../packages/http/errors.ts";

test("preparation metadata requires authentication, technical modes and an owned active session", async () => {
  const fixture = await repositoryAgentFixture();
  let authenticated = false, workspaceId = fixture.owner.workspaceId;
  const workspace = workspaces(new SqliteWorkspaces(fixture.connection), () => new Date());
  const app = new Elysia().onError(({ error, set }) => {
    if (error instanceof HttpError) { set.status = error.status; return { error: error.code }; }
  }).use(repositoryPreparationRoutes({ resolve: async () => authenticated
    ? { userId: fixture.owner.actorId, workspaceId, locale: "pt-BR" } : null }, workspace, fixture.sessions, "/api"));
  const get = (path: string) => app.handle(new Request("http://fixture.local/api/repository-preparation/" + path));
  try {
    expect((await get("modes/technical")).status).toBe(401);
    authenticated = true;
    expect((await get("modes/recruiter")).status).toBe(404);
    expect((await get("modes/missing")).status).toBe(404);
    const metadata = await (await get("modes/technical")).json() as Record<string, unknown>;
    expect(metadata.modeId).toBe("technical");
    expect(String(metadata.actorId)).toHaveLength(24);
    expect(JSON.stringify(metadata)).not.toContain(fixture.owner.actorId);
    expect(Object.keys(metadata).sort()).toEqual(["actorId", "modeId", "workspaceId"]);
    const path = "sessions/" + fixture.owner.sessionId;
    expect(await (await get(path)).json()).toMatchObject({ ...metadata, sessionId: fixture.owner.sessionId });
    workspaceId = crypto.randomUUID();
    expect((await get(path)).status).toBe(404);
    const other = await (await get("modes/technical")).json() as Record<string, unknown>;
    expect(other.workspaceId).not.toBe(metadata.workspaceId);
    workspaceId = fixture.owner.workspaceId;
    const session = (await fixture.sessions.find(workspaceId, fixture.owner.sessionId))!;
    await fixture.sessions.change(workspaceId, session.id, current => ({ next: { ...current, state: "ended" } }));
    expect((await get(path)).status).toBe(404);
    expect(fixture.requests).toHaveLength(0);
  } finally { await fixture.close(); }
});
