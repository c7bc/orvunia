import assert from "node:assert/strict";
import { readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

async function payloadPaths(directory, prefix) {
  const paths = [];
  async function inspect(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      assert.ok(!entry.isSymbolicLink(), "Distribution path guard requires a materialized payload");
      if (entry.isDirectory()) await inspect(path);
      else if (entry.isFile()) paths.push(join(prefix, relative(directory, path)).replaceAll("/", "\\"));
    }
  }
  await inspect(directory);
  return paths;
}

export function installationPathBudget(paths) {
  assert.ok(paths.length);
  const longest = paths.reduce((previous, path) => path.length > previous.length ? path : previous, "");
  const maximumDirectoryLength = 259 - 1 - longest.length;
  assert.ok(maximumDirectoryLength >= 64, "Payload leaves no practical installation directory allowance");
  return { maximumPathLength: 259, longestRelativePath: longest, longestRelativeLength: longest.length,
    maximumDirectoryLength, rejectionExitCode: 206, hook: "customHeader-first-hidden-section" };
}

export async function writeInstallationPathGuard(runtime, electronDirectory, destination, productName = "Orvunia QA") {
  assert.equal(productName, "Orvunia QA");
  const paths = [...(runtime ? await payloadPaths(runtime, "resources\\cadence-runtime") : []),
    ...await payloadPaths(electronDirectory, ""), "resources\\app.asar", `Uninstall ${productName}.exe`];
  const policy = installationPathBudget(paths), include = join(destination, "installation-path-guard.nsh");
  const text = `!macro customHeader
  !ifndef BUILD_UNINSTALLER
    Section "-Validate installation destination"
      StrLen $R8 $INSTDIR
      IntCmp $R8 ${policy.maximumDirectoryLength} supported supported unsupported
      unsupported:
        IfSilent fail
        MessageBox MB_OK|MB_ICONSTOP "Installation folder is too long. Choose a shorter folder (max ${policy.maximumDirectoryLength} characters).$\\r$\\nPasta de instalacao muito longa. Escolha uma pasta mais curta (max ${policy.maximumDirectoryLength} caracteres).$\\r$\\nLa carpeta de instalacion es demasiado larga. Elija una carpeta mas corta (max ${policy.maximumDirectoryLength} caracteres)."
      fail:
        SetErrorLevel ${policy.rejectionExitCode}
        Quit
      supported:
    SectionEnd
  !endif
!macroend
`;
  await writeFile(include, text, { flag: "wx" });
  return { ...policy, include };
}
