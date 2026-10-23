const electron = require("electron");
const path = require("node:path");
const { createNativeApplication, createWindowMotion } = require("./runtime.cjs");

try {
  createNativeApplication({
    electron, process, metadata: require("../package.json"),
    root: path.resolve(__dirname, ".."), desktopDirectory: __dirname,
    resourcesPath: process.resourcesPath, createMotion: createWindowMotion,
  });
} catch (error) {
  if (process.argv.includes("--smoke-background")) console.error("Background native initialization failed.");
  else electron.dialog.showErrorBox("Orvunia não iniciou", error instanceof Error ? error.message : "Native initialization failed");
  electron.app.exit(1);
}
