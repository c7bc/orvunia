import assert from "node:assert/strict";
import { baseline } from "./config.mjs";
export function baselineAsset(release, releaseId) {
  assert.ok(Number.isSafeInteger(Number(releaseId)) && /^[1-9]\d*$/.test(String(releaseId)), "Exact release ID required");
  assert.equal(release.id, Number(releaseId)); assert.equal(release.draft, true, "Baseline must remain unpublished");
  assert.equal(release.tag_name, baseline.tag); assert.equal(release.published_at, null);
  assert.ok(Array.isArray(release.assets) && release.assets.length <= 100);
  const matches = release.assets.filter(asset => asset.name === baseline.name);
  assert.equal(matches.length, 1); const asset = matches[0];
  assert.ok(Number.isSafeInteger(asset.id) && asset.id > 0); assert.equal(asset.state, "uploaded");
  assert.equal(asset.size, baseline.bytes);
  if (asset.digest) assert.equal(asset.digest, "sha256:" + baseline.sha256);
  return { id: asset.id, bytes: asset.size, sha256: baseline.sha256 };
}
export function releaseId(value) {
  assert.ok(/^[1-9]\d*$/.test(value ?? "") && Number.isSafeInteger(Number(value)), "Numeric release ID required");
  return Number(value);
}
export function assetRedirect(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:"); assert.equal(url.hostname, "release-assets.githubusercontent.com");
  assert.ok(!url.username && !url.password && !url.hash && (!url.port || url.port === "443"));
  return url.href;
}
