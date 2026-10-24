import assert from "node:assert/strict";
import { join } from "node:path";
import { seedStore } from "./store.mjs";
export async function seedProfile({ profile, workspaceId, selected, prepare, connect, sessions }) {
  const options = { profile, seed: workspaceId, quiesced: true, signal: new AbortController().signal };
  const prepared = await prepare(options);
  assert.equal(prepared.workspaceId, workspaceId);
  const connection = connect(join(prepared.directory, "cadence-next.sqlite"));
  try { await seedStore(sessions(connection), prepared.workspaceId, selected); }
  finally { connection.close(); }
  const reopened = await prepare(options);
  assert.equal(reopened.directory, prepared.directory);
  assert.equal(reopened.workspaceId, prepared.workspaceId);
  return reopened;
}
