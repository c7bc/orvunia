import { z } from "zod";
export function desktopWorkspace(
  owners: readonly string[],
  seed: string,
  selected?: string,
) {
  const identifiers = new Set(owners.map((value) => z.uuid().parse(value)));
  if (selected) {
    if (!identifiers.has(z.uuid().parse(selected)))
      throw Error("The selected legacy workspace is unavailable");
    return selected;
  }
  if (identifiers.size > 1)
    throw Error("Select the existing workspace before desktop migration");
  return identifiers.values().next().value ?? z.uuid().parse(seed);
}
