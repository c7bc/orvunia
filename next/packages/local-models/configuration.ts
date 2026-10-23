import { z } from "zod";
import { isAbsolute } from "node:path";
import type { RuntimeBinary } from "./runtime.ts";
import { fileURLToPath } from "node:url";
import { bundledRuntimes } from "./bundled.ts";

export async function runtimeConfiguration(environment: Record<string, string | undefined>) {
  const runtimes: { llama?: RuntimeBinary; whisper?: RuntimeBinary } = await bundledRuntimes(
    environment.ORVUNIA_MODEL_RUNTIME_DIRECTORY ?? fileURLToPath(new URL("../../runtime/", import.meta.url)),
    Boolean(environment.ORVUNIA_MODEL_RUNTIME_DIRECTORY));
  for (const runtime of ["llama", "whisper"] as const) {
    const prefix = `ORVUNIA_${runtime.toUpperCase()}_RUNTIME`;
    const values = [environment[`${prefix}_PATH`], environment[`${prefix}_SHA256`], environment[`${prefix}_VERSION`]];
    if (!values.some(Boolean)) continue;
    runtimes[runtime] = z.object({ path: z.string().refine(isAbsolute),
      sha256: z.string().regex(/^[a-f0-9]{64}$/), version: z.string().min(1).max(100) })
      .parse({ path: values[0], sha256: values[1], version: values[2] });
  }
  return runtimes;
}
