import { z } from "zod";
import { readPrivateFile } from "../providers/private-file.ts";
import { connectionInput } from "../contracts/providers.ts";
import { definedFields } from "../contracts/defined.ts";
import { fileConnections } from "../providers/file.ts";
import { fileVault } from "../providers/vault.ts";
import type { SecretVault } from "../providers/domain.ts";
const saved = z.discriminatedUnion("protection", [
  z
    .object({
      version: z.literal(1),
      protection: z.literal("file"),
      connections: connectionInput,
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      protection: z.literal("os"),
      payload: z.string().min(1).max(40000),
    })
    .strict(),
]);
export async function migrateInstallationProviders(
  source: string,
  target: string,
  vault?: SecretVault,
) {
  const value = saved.parse(
    JSON.parse((await readPrivateFile(source, 40000)).toString("utf8")),
  );
  if (value.protection === "os" && !vault)
    throw Error(
      "Legacy provider connections require the original operating-system vault",
    );
  const connections =
    value.protection === "file"
      ? value.connections
      : connectionInput.parse(JSON.parse(await vault!.open(value.payload)));
  await fileConnections(target, vault ?? fileVault(`${target}.key`)).write({
    response: definedFields(connections.response),
    transcription: definedFields(connections.transcription),
  });
}
