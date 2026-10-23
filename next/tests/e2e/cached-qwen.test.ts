import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { installCachedModel } from "../support/cached-model.ts";

test.skipIf(!process.env.ORVUNIA_TEST_QWEN_CACHE)("pinned Qwen cache copies through verified production artifacts", async () => {
  const environment = await capabilityEnvironment();
  try {
    const weights = process.env.ORVUNIA_TEST_QWEN_CACHE!;
    const projector = process.env.ORVUNIA_TEST_PROJECTOR_CACHE;
    const result = await installCachedModel(environment, "qwen3.5-0.8b-q4", { weights, ...(projector ? { projector } : {}) });
    expect(result.installed.state).toBe("installed");
  } finally { await environment.close(); }
}, 120_000);
