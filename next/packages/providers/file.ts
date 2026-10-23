import { readPrivateFile } from "./private-file.ts";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { connectionInput } from "../contracts/providers.ts";
import { definedFields } from "../contracts/defined.ts";
import type { ConnectionRepository, SecretVault } from "./domain.ts";

export function fileConnections(
  filename: string,
  vault: SecretVault,
): ConnectionRepository {
  return {
    async read() {
      let serialized: string;
      try {
        serialized = (await readPrivateFile(filename, 40_000)).toString("utf8");
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return null;
        throw error;
      }
      const value = connectionInput.parse(
        JSON.parse(await vault.open(serialized)),
      );
      return {
        response: definedFields(value.response),
        transcription: definedFields(value.transcription),
      };
    },
    async write(connections) {
      const payload = await vault.seal(
        JSON.stringify(connectionInput.parse(connections)),
      );
      await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
      const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
      try {
        const handle = await open(temporary, "wx", 0o600);
        try {
          await handle.writeFile(payload);
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporary, filename);
      } finally {
        await unlink(temporary).catch((error) => {
          if (!(
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          ))
            throw error;
        });
      }
    },
  };
}
