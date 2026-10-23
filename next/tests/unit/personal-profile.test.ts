import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { personalProfile } from "../../apps/personal/profile.ts";
import { personalSettings } from "../../apps/personal/configuration.ts";

test("personal profile locks one process, preserves identity and files, and rejects corruption without replacement", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-personal-profile-"));
  let profile: ReturnType<typeof personalProfile> | null = null;
  try {
    await writeFile(join(directory, "preserved.txt"), "synthetic original");
    profile = personalProfile(directory);
    const first = profile.identity;
    expect(() => personalProfile(directory)).toThrow("already in use");
    profile.close();
    profile.close();
    profile = personalProfile(directory);
    expect(profile.identity).toEqual(first);
    expect(await readFile(join(directory, "preserved.txt"), "utf8")).toBe(
      "synthetic original",
    );
    profile.close();
    profile = null;
    await writeFile(
      join(directory, "runtime-profile.json"),
      "malformed synthetic identity",
    );
    expect(() => personalProfile(directory)).toThrow("invalid");
    expect(
      await readFile(join(directory, "runtime-profile.json"), "utf8"),
    ).toBe("malformed synthetic identity");
  } finally {
    profile?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("personal settings select owned storage and loopback browser mode without cloud services", () => {
  const identity = { token: "x".repeat(43), workspaceId: crypto.randomUUID() };
  const settings = personalSettings(
    {
      PORT: "9921",
      CADENCE_LOCAL_TOKEN: "untrusted",
      CADENCE_SQLITE_PATH: "unowned",
    },
    "chosen",
    identity,
  );
  expect(settings.CADENCE_LOCAL_BROWSER).toBe(true);
  expect(settings.CADENCE_LOCAL_TOKEN).toBe(identity.token);
  expect(settings.CADENCE_SQLITE_PATH).toBe(
    join("chosen", "cadence-next.sqlite"),
  );
  expect(settings.CADENCE_PUBLIC_URL).toBe("http://127.0.0.1:9921");
  for (const environment of [
    { CADENCE_DEPLOYMENT: "cloud" },
    { CADENCE_BIND_HOST: "0.0.0.0" },
    { CADENCE_PUBLIC_URL: "http://127.0.0.1:9999" },
  ])
    expect(() => personalSettings(environment, "chosen", identity)).toThrow();
});

test("personal OS lock rejects a second process and recovers unchanged identity after a crash", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-personal-crash-"));
  let acknowledge: () => void = () => {};
  const locked = new Promise<void>((resolve) => {
    acknowledge = resolve;
  });
  const child = Bun.spawn(
    [
      process.execPath,
      new URL("../support/personal-lock.ts", import.meta.url).pathname.replace(
        /^\/(?=[A-Za-z]:)/,
        "",
      ),
      directory,
    ],
    {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "pipe",
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
      ipc(message) {
        if (
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "profile_locked"
        )
          acknowledge();
      },
    },
  );
  const deadline = setTimeout(() => child.kill(), 10000);
  try {
    await Promise.race([
      locked,
      child.exited.then(() => {
        throw Error("Lock fixture exited before acquiring ownership");
      }),
    ]);
    const original = await readFile(
      join(directory, "runtime-profile.json"),
      "utf8",
    );
    expect(() => personalProfile(directory)).toThrow("already in use");
    child.kill(9);
    await child.exited;
    const recovered = personalProfile(directory);
    try {
      expect(JSON.parse(original)).toEqual(recovered.identity);
    } finally {
      recovered.close();
    }
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null) child.kill();
    await child.exited;
    await rm(directory, { recursive: true, force: true });
  }
});
