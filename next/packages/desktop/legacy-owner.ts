import { createHash } from "node:crypto";
import { z } from "zod";
import type { LegacyCookies } from "./legacy-types.ts";
export async function legacyDesktopOwner(
  cookies: Pick<LegacyCookies, "get">,
  directory: string,
  origin: string,
) {
  const name = `cadence_owner_${createHash("sha256").update(directory).digest("hex").slice(0, 12)}`;
  for (const candidate of [name, "cadence_owner"]) {
    const values = await cookies.get({ url: origin, name: candidate });
    if (!values.length) continue;
    const selected = z.uuid().safeParse(values[0]?.value);
    if (!selected.success || values.length !== 1)
      throw Error("The existing desktop workspace credential is invalid");
    return selected.data;
  }
  return undefined;
}
