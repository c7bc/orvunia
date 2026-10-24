import { loadContext } from "./context.mjs";
import { baseline, appId, productName, desktopVersion } from "./config.mjs";
console.log(JSON.stringify({ state: await loadContext(process.argv[2]), baseline, appId, productName, desktopVersion }));
