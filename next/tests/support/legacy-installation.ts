import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { Database } from "bun:sqlite";
import { legacyFixture } from "./legacy-fixture.ts";
import { legacyRequests } from "./legacy-requests.ts";
import { onboardingSchema } from "../../packages/contracts/onboarding.ts";
import type { SecretVault, Connections } from "../../packages/providers/domain.ts";
export async function legacyInstallation(root: string, vault?: SecretVault) {
  await mkdir(root, { mode: 0o700 });
  const original = legacyFixture(join(root, "cadence.sqlite"));
  legacyRequests(original);
  const onboarding = onboardingSchema.parse({
      completed: true,
      persona: "professional",
      industry: "Software",
      output: "en",
      code: "Rust",
      tutorialComplete: true,
    }),
    connection = new Database(join(root, "onboarding.sqlite")),
    calendar = new Database(join(root, "calendar.sqlite"));
  connection.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE onboarding(owner_id TEXT PRIMARY KEY,state TEXT NOT NULL)",
  );
  connection
    .query("INSERT INTO onboarding VALUES(?,?)")
    .run(original.owner, JSON.stringify(onboarding));
  calendar.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE calendar_connections(owner_id TEXT PRIMARY KEY,tokens TEXT,events TEXT,synced_at TEXT,error TEXT,reconnect INTEGER); CREATE TABLE calendar_oauth_states(state_hash TEXT PRIMARY KEY,owner_id TEXT,verifier TEXT,expires_at INTEGER)",
  );
  const key = randomBytes(32),
    state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url"),
    now = Date.now();
  const seal = vault
    ? (value: string) => vault.seal(value)
    : async (value: string) => {
        const nonce = randomBytes(12),
          cipher = createCipheriv("aes-256-gcm", key, nonce),
          data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString(
          "base64url",
        );
      };
  const tokens = {
      accessToken: "synthetic-calendar-access",
      refreshToken: "synthetic-calendar-refresh",
      expiresAt: now + 3600000,
    },
    event = {
      id: "synthetic-event",
      title: "Agenda preservada",
      start: new Date(now + 600000).toISOString(),
      end: new Date(now + 1200000).toISOString(),
      allDay: false,
      timeZone: "America/Sao_Paulo",
      location: "Local",
      url: "https://calendar.google.com/calendar/event?eid=synthetic",
      joinUrl: "https://meet.google.com/synthetic",
    };
  calendar
    .query("INSERT INTO calendar_connections VALUES(?,?,?,?,?,?)")
    .run(
      original.owner,
      await seal(JSON.stringify(tokens)),
      JSON.stringify([event]),
      new Date(now).toISOString(),
      "",
      0,
    );
  calendar
    .query("INSERT INTO calendar_oauth_states VALUES(?,?,?,?)")
    .run(
      createHash("sha256").update(state).digest("hex"),
      original.owner,
      await seal(verifier),
      now + 600000,
    );
  if (!vault)
    await writeFile(join(root, ".calendar-key"), key, { mode: 0o600 });
  const connections: Connections = {
    response: {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "synthetic-custom-model",
      vision: true,
      maxTokens: 3000,
      apiKey: "synthetic-preserved-provider-secret",
    },
    transcription: {
      provider: "deepgram",
      baseUrl: "https://api.deepgram.com/v1",
      model: "nova-3",
      realtimeModel: "gpt-live-transcribe",
      apiKey: "synthetic-transcription-secret",
    },
  };
  await writeFile(
    join(root, "providers.json"),
    JSON.stringify(
      vault
        ? {
            version: 1,
            protection: "os",
            payload: await vault.seal(JSON.stringify(connections)),
          }
        : { version: 1, protection: "file", connections },
    ),
    { mode: 0o600 },
  );
  await writeFile(
    join(root, "external-env.json"),
    JSON.stringify({
      path: "/synthetic/external/never-read.env",
      distro: "Ubuntu",
    }),
    { mode: 0o600 },
  );
  return {
    original,
    onboarding,
    tokens,
    event,
    state,
    verifier,
    connections,
    snapshot: () => [
      original.database.serialize(),
      connection.serialize(),
      calendar.serialize(),
    ],
    close() {
      calendar.close(true);
      connection.close(true);
      original.database.close(true);
    },
  };
}
