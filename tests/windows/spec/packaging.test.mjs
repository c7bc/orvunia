import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { desktopConfiguration } from "../configuration.mjs";
const root = new URL("../../../", import.meta.url);
test("each explicit desktop input belongs to the pinned public bootstrap or generated bundle", async () => {
  const files = desktopConfiguration("source", "runtime", "output", "electron").files;
  for (const path of files.filter(path => path.startsWith("./desktop/") && !path.includes("*"))) {
    if (path === "./desktop/runtime.cjs") continue;
    await access(new URL(path.slice(2), root));
  }
  const main = await readFile(new URL("desktop/main.cjs", root), "utf8");
  assert.match(main, /createWindowMotion/);
  assert.match(main, /require\("\.\/runtime\.cjs"\)/);
});
test("builders explicitly suppress publish and installers have a separate bounded deadline", async () => {
  const worker = await readFile(new URL("../worker.mjs", import.meta.url), "utf8");
  assert.match(worker, /publish: "never"/);
  const support = await readFile(new URL("../lifecycle-support.ps1", import.meta.url), "utf8");
  assert.match(support, /\$DeadlineSeconds = 240/);
  assert.match(support, /WaitForExit\(\$DeadlineSeconds \* 1000\)/);
  const lifecycle = await readFile(new URL("../lifecycle.ps1", import.meta.url), "utf8");
  assert.equal((lifecycle.match(/-DeadlineSeconds 600/g) ?? []).length, 2);
  assert.ok(!/function Run-Native[^\n]*-DeadlineSeconds/.test(lifecycle));
});
test("synchronous NSIS uninstall uses an exact outside copy and final owned target argument", async () => {
  const support = await readFile(new URL("../lifecycle-support.ps1", import.meta.url), "utf8");
  assert.match(support, /\[IO.File\]::Copy\(\$source, \$copy, \$false\)/);
  assert.match(support, /Get-FileHash -LiteralPath \$copy/);
  assert.match(support, /Invoke-OwnedProcess \$copy @\('\/S', \('_\?=' \+ \$qa.installation\)\)/);
  assert.match(support, /Synchronous NSIS QA target must be space-free/);
  const lifecycle = await readFile(new URL("../lifecycle.ps1", import.meta.url), "utf8");
  assert.match(lifecycle, /Invoke-OwnedUninstall 'uninstall'/);
  assert.match(lifecycle, /Invoke-OwnedUninstall 'cleanup-owned-install'/);
  assert.match(lifecycle, /throw 'Uninstall retained executable or registration'/);
});
