import {
  mkdirSync,
  existsSync,
  readdirSync,
  lstatSync,
  openSync,
  readSync,
  fstatSync,
  closeSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
const profileSchema = z
  .object({
    format: z.literal("cadence-desktop-candidate/1"),
    workspaceId: z.uuid(),
    token: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  })
  .strict();
export type CandidateProfile = z.infer<typeof profileSchema>;
export function prepareCandidateProfile(directory: string): CandidateProfile {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (realpathSync(directory) !== resolve(directory))
    throw Error("Candidate profile must be a real isolated directory");
  const filename = join(directory, "candidate-profile.json");
  if (!existsSync(filename)) {
    if (readdirSync(directory).length)
      throw Error("Candidate profile must be empty or previously prepared");
    const value: CandidateProfile = {
      format: "cadence-desktop-candidate/1",
      workspaceId: randomUUID(),
      token: randomBytes(32).toString("base64url"),
    };
    writeFileSync(filename, JSON.stringify(value) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    return value;
  }
  const info = lstatSync(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2048)
    throw Error("Candidate profile metadata is invalid");
  const handle = openSync(
    filename,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const opened = fstatSync(handle);
    if (
      !opened.isFile() ||
      opened.ino !== info.ino ||
      opened.dev !== info.dev ||
      opened.size > 2048
    )
      throw Error("Candidate profile metadata is invalid");
    const data = Buffer.alloc(2049);
    let length = 0;
    while (length < data.length) {
      const count = readSync(handle, data, length, data.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > 2048) throw Error("Candidate profile metadata is invalid");
    return profileSchema.parse(
      JSON.parse(data.subarray(0, length).toString("utf8")),
    );
  } catch {
    throw Error("Candidate profile metadata is invalid");
  } finally {
    closeSync(handle);
  }
}
