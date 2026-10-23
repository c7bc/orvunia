import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { personalProfile } from "./profile.ts";
import { personalSettings } from "./configuration.ts";
import { composePersonal as composeApi } from "../api/personal-compose.ts";
import { serveApplication } from "../api/serve.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";

let profile: ReturnType<typeof personalProfile> | null = null;
let application: Awaited<ReturnType<typeof composeApi>> | null = null;
try {
  profile = personalProfile(
    process.env.CADENCE_PERSONAL_DIRECTORY || join("data", "personal"),
  );
  const settings = personalSettings(
    process.env,
    profile.directory,
    profile.identity,
  );
  const database = sqliteConnection(settings.CADENCE_SQLITE_PATH);
  try {
    await migrateSqlite(database);
  } finally {
    database.close();
  }
  application = await composeApi(settings, {
    clientDirectory:
      process.env.CADENCE_CLIENT_DIRECTORY ||
      fileURLToPath(new URL("../../../", import.meta.url)),
  });
  serveApplication(application, settings, profile, process);
  console.log(
    JSON.stringify({
      event: "personal_started",
      origin: settings.CADENCE_PUBLIC_URL,
    }),
  );
} catch {
  try {
    await application?.close();
  } finally {
    profile?.close();
    console.error(JSON.stringify({ event: "personal_startup_failed" }));
    process.exitCode = 1;
  }
}
