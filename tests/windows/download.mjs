import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { loadContext } from "./context.mjs";
import { baseline, repository } from "./config.mjs";
import { baselineAsset, releaseId, assetRedirect } from "./baseline.mjs";
const [statePath, input] = process.argv.slice(2), state = await loadContext(statePath), id = releaseId(input);
const token = process.env.GH_TOKEN; assert.ok(token && !/[\r\n]/.test(token), "Ephemeral repository token required");
const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10" };
const prefix = `https://api.github.com/repos/${repository}/releases/`;
const metadata = await fetch(prefix + id, { headers, redirect: "error", signal: AbortSignal.timeout(30000) });
if ([401, 403, 404].includes(metadata.status)) throw Error("Draft baseline inaccessible with contents:read; no permission escalation attempted");
assert.equal(metadata.status, 200); const text = await metadata.text(); assert.ok(text.length < 2000000);
const asset = baselineAsset(JSON.parse(text), id);
let response = await fetch(prefix + "assets/" + asset.id, { headers: { ...headers, Accept: "application/octet-stream" },
  redirect: "manual", signal: AbortSignal.timeout(30000) });
if (response.status === 302) {
  const target = assetRedirect(response.headers.get("location")); await response.body?.cancel();
  response = await fetch(target, { redirect: "error", signal: AbortSignal.timeout(600000) });
}
assert.equal(response.status, 200, "Baseline asset cannot be downloaded with current read permission");
const length = response.headers.get("content-length"); if (length) assert.equal(Number(length), baseline.bytes);
const checksum = createHash("sha256"); let bytes = 0;
const counter = new Transform({ transform(chunk, _encoding, done) {
  bytes += chunk.length;
  if (bytes > baseline.bytes) return done(Error("Baseline exceeds exact approved size"));
  checksum.update(chunk); done(null, chunk);
} });
const partial = join(state.baseline, baseline.name + ".partial"), destination = join(state.baseline, baseline.name);
await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(partial, { flags: "wx" }), { signal: AbortSignal.timeout(600000) });
assert.equal(bytes, baseline.bytes); assert.equal(checksum.digest("hex"), baseline.sha256);
await rename(partial, destination);
await writeFile(join(state.evidence, "baseline.json"), JSON.stringify({ version: baseline.version, releaseId: id,
  assetId: asset.id, tag: baseline.tag, bytes, sha256: baseline.sha256, provenance: baseline.sourceProvenance,
  draft: true, published: false, tokenStored: false }, null, 2), { flag: "wx" });
console.log("Historical baseline downloaded and checksum verified; no application executed.");
