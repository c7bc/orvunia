import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { desktopEnvironment } from "../../packages/desktop/environment.ts";
test("desktop configuration preserves providers and explicit values while excluding runtime overrides and unrelated secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-desktop-environment-"));
  const dataDirectory = join(root, "data");
  await mkdir(dataDirectory);
  try {
    await writeFile(
      join(root, ".env"),
      [
        'OPENAI_API_KEY="synthetic-env-key"',
        "OPENAI_RESPONSE_MODEL=preserved-model",
        "CADENCE_RESPONSE_PROVIDER=anthropic",
        "ANTHROPIC_API_KEY=synthetic-other-key",
        "PORT=12345",
        "NODE_OPTIONS=--require=untrusted",
        "DATABASE_URL=private-database",
        "CADENCE_LOCAL_TOKEN=overridden-token",
        "CADENCE_SQLITE_PATH=other-data",
      ].join("\n"),
    );
    let externalReads = 0;
    const result = await desktopEnvironment({
      root,
      dataDirectory,
      signal: new AbortController().signal,
      environment: {
        OPENAI_RESPONSE_MODEL: "explicit-model",
        CADENCE_VISION: "false",
        CADENCE_FREE_ANSWERS: "0",
        CADENCE_GOOGLE_CLIENT_SECRET: "synthetic-google-secret",
      },
      readExternal: async () => {
        externalReads++;
        throw Error(
          "Should never follow a configured external file when a key already exists",
        );
      },
    });
    expect(result).toEqual({
      OPENAI_API_KEY: "synthetic-env-key",
      OPENAI_RESPONSE_MODEL: "explicit-model",
      CADENCE_RESPONSE_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "synthetic-other-key",
      CADENCE_VISION: "false",
      CADENCE_GOOGLE_CLIENT_SECRET: "synthetic-google-secret",
    });
    expect(externalReads).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the configured external environment supplies only the OpenAI key with no shell interpolation or provider configuration replacement", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-desktop-external-"));
  const dataDirectory = join(root, "data");
  await mkdir(dataDirectory);
  const signal = new AbortController().signal;
  try {
    const path = "/synthetic/workspace/zapyflow-envs/.env";
    await writeFile(
      join(dataDirectory, "external-env.json"),
      JSON.stringify({ path, distro: "Ubuntu-24.04" }),
    );
    const calls: { path: string; distro: string; signal: AbortSignal }[] = [];
    const result = await desktopEnvironment({
      root,
      dataDirectory,
      signal,
      environment: { OPENAI_RESPONSE_MODEL: "retained-model" },
      readExternal: async (options) => {
        calls.push(options);
        return "OPENAI_API_KEY=synthetic-external-key\nOTHER_SECRET=never-inherited\nOPENAI_RESPONSE_MODEL=unrelated-model\nCADENCE_LOCAL_TOKEN=untrusted";
      },
    });
    expect(calls).toEqual([{ path, distro: "Ubuntu-24.04", signal }]);
    expect(result).toEqual({
      OPENAI_API_KEY: "synthetic-external-key",
      OPENAI_RESPONSE_MODEL: "retained-model",
    });
    const external = join(root, "synthetic-external.env");
    await writeFile(
      external,
      'OPENAI_API_KEY="synthetic-local-external-key"\nOTHER_SECRET=excluded',
    );
    expect(
      await desktopEnvironment({
        root,
        dataDirectory,
        signal,
        environment: { ZAPYFLOW_ENV_PATH: external },
      }),
    ).toEqual({ OPENAI_API_KEY: "synthetic-local-external-key" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("external configuration failure preserves offline access and reports no private details; cancellation cannot return a late credential", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadence-desktop-env-failure-"));
  const dataDirectory = join(root, "data");
  await mkdir(dataDirectory);
  const controller = new AbortController();
  try {
    const options = {
      root,
      dataDirectory,
      signal: controller.signal,
      environment: { ZAPYFLOW_ENV_PATH: "/synthetic/external.env" },
    };
    let unavailable = 0;
    const result = await desktopEnvironment({
      ...options,
      onExternalUnavailable: () => { unavailable++; },
      readExternal: async () => {
        throw Error("synthetic-secret-must-not-escape");
      },
    });
    expect(result).toEqual({});
    expect(unavailable).toBe(1);
    expect(JSON.stringify(result)).not.toContain("synthetic-secret-must-not-escape");
    await expect(
      desktopEnvironment({
        ...options,
        environment: { CADENCE_DEPLOYMENT: "cloud" },
      }),
    ).rejects.toThrow("personal local backend");
    await expect(
      desktopEnvironment({
        ...options,
        readExternal: async () => {
          controller.abort();
          return "OPENAI_API_KEY=synthetic-late-key";
        },
      }),
    ).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
