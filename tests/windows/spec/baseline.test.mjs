import test from "node:test";
import assert from "node:assert/strict";
import { baselineAsset, assetRedirect, releaseId } from "../baseline.mjs";
import { baseline } from "../config.mjs";
const release = { id: 123, draft: true, tag_name: baseline.tag, published_at: null,
  assets: [{ id: 456, name: baseline.name, size: baseline.bytes, state: "uploaded", digest: "sha256:" + baseline.sha256 }] };
test("baseline admission uses the independently fixed historical digest and exact draft asset", () => {
  assert.deepEqual(baselineAsset(release, "123"), { id: 456, bytes: baseline.bytes, sha256: baseline.sha256 });
  for (const changed of [{ ...release, draft: false }, { ...release, id: 124 }, { ...release, tag_name: "other" },
    { ...release, published_at: "2026-01-01" }, { ...release, assets: [] }, { ...release, assets: [release.assets[0], release.assets[0]] }])
    assert.throws(() => baselineAsset(changed, "123"));
  for (const mutation of [{ digest: "sha256:" + "0".repeat(64) }, { size: baseline.bytes - 1 }, { name: "another.exe" },
    { id: 0 }, { state: "pending" }]) assert.throws(() => baselineAsset({ ...release, assets: [{ ...release.assets[0], ...mutation }] }, "123"));
});
test("release identifiers and redirected download locations cannot become arbitrary URLs or paths", () => {
  assert.equal(releaseId("123"), 123);
  for (const value of [undefined, "", "0", "-1", "001", "1.5", "../123", "999999999999999999999999"])
    assert.throws(() => releaseId(value));
  assert.equal(assetRedirect("https://release-assets.githubusercontent.com/asset?temporary=example"),
    "https://release-assets.githubusercontent.com/asset?temporary=example");
  for (const value of ["http://release-assets.githubusercontent.com/a", "https://evil.test/a", "https://127.0.0.1/a",
    "https://user:pass@release-assets.githubusercontent.com/a", "https://release-assets.githubusercontent.com:444/a",
    "https://release-assets.githubusercontent.com/a#fragment", "https://release-assets.githubusercontent.com.evil.test/a"])
    assert.throws(() => assetRedirect(value));
});
