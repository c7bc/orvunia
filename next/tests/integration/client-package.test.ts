import { expect, test } from "bun:test";
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  readdir,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { packageClient } from "../../packages/client/package.ts";
import { staticClient } from "../../packages/client/static.ts";

test("physical client packages serve every catalog entry without shipping backend, configuration, or source modules", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-client-package-"));
  const source = resolve(import.meta.dir, "../../..");
  const target = join(directory, "client");
  try {
    const manifest = await packageClient(source, target, {
      vendorDirectory: source,
    });
    expect(manifest.format).toBe("cadence-client/1");
    const disk = JSON.parse(
      await readFile(join(target, "client-manifest.json"), "utf8"),
    );
    expect(disk).toEqual(manifest);
    const serve = await staticClient(target);
    const routes: string[] = JSON.parse(
      await readFile(join(target, "assets/client-routes.json"), "utf8"),
    );
    for (const path of [
      ...routes,
      "/vendor/marked.js",
      "/vendor/purify.js",
      "/vendor/highlight.js",
      "/assets/gaze/wasm/vision_wasm_internal.wasm",
    ]) {
      const response = await serve(new Request("http://localhost:9915" + path));
      expect(response?.status).toBe(200);
    }
    for (const file of manifest.files) {
      const data = await readFile(join(target, file.path));
      expect(data.length).toBe(file.bytes);
      expect(createHash("sha256").update(data).digest("hex")).toBe(file.sha256);
      expect(
        /(?:^|\/)(?:next|backend|client|desktop|work|data)\//.test(file.path),
      ).toBe(false);
    }
    for (const [path, type] of [
      ["/assets/icon.png", "image/png"],
      ["/assets/brand/logo.svg", "image/svg+xml"],
    ]) {
      const response = await serve(new Request("http://localhost:9915" + path));
      expect(response?.headers.get("content-type")).toBe(type);
      expect(response?.headers.get("x-content-type-options")).toBe("nosniff");
      expect(new Uint8Array(await response!.arrayBuffer())).toEqual(
        new Uint8Array(await readFile(join(source, path!.slice(1)))),
      );
    }
    expect((await readdir(join(target, "node_modules/marked"))).sort()).toEqual(
      ["LICENSE", "lib"],
    );
    expect(
      await serve(new Request("http://localhost:9915/client-manifest.json")),
    ).toBeNull();
    await expect(
      packageClient(source, target, {
        vendorDirectory: source,
      }),
    ).rejects.toThrow();
    expect(
      JSON.parse(await readFile(join(target, "client-manifest.json"), "utf8")),
    ).toEqual(manifest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an incomplete or escaping client source cannot produce a usable package or replace existing files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-client-reject-"));
  const source = join(directory, "source");
  const target = join(directory, "target");
  await mkdir(join(source, "assets"), { recursive: true });
  try {
    await writeFile(
      join(source, "assets/client-routes.json"),
      '["/../private.json"]',
    );
    await expect(packageClient(source, target)).rejects.toThrow();
    await expect(readdir(target)).rejects.toThrow();
    await writeFile(
      join(source, "assets/client-routes.json"),
      '["/desktop.html"]',
    );
    await expect(packageClient(source, target)).rejects.toThrow();
    await expect(readdir(target)).rejects.toThrow();
    await expect(packageClient(source, directory)).rejects.toThrow(
      "fresh destination",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
