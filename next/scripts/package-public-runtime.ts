import { packagePublicRuntime } from "../packages/desktop/public-package.ts";
const [source, binary, checksum, destination, modelRuntimeDirectory, ...extra] = process.argv.slice(2);
if (!source || !binary || !checksum || !destination || extra.length)
  throw Error("Usage: bun next/scripts/package-public-runtime.ts PUBLIC_SOURCE BUN_EXECUTABLE BUN_SHA256 NEW_DESTINATION [MODEL_RUNTIME_DIRECTORY]");
const controller = new AbortController();
const stop = () => controller.abort();
process.once("SIGINT", stop); process.once("SIGTERM", stop);
try {
  const result = await packagePublicRuntime({ source, binary, checksum, destination, signal: controller.signal,
    ...(modelRuntimeDirectory ? { modelRuntimeDirectory } : {}) });
  console.log(JSON.stringify({ event: "public_runtime_packaged", ...result }));
} finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
