import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { staticClient } from "../../packages/client/static.ts";
test("source clients resolve only explicit public vendor aliases from the supplied dependency root", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cadence-client-vendors-")),
    client = join(directory, "client"),
    vendors = join(directory, "vendors");
  try {
    await mkdir(join(client, "assets"), { recursive: true });
    await mkdir(join(vendors, "node_modules/marked/lib"), { recursive: true });
    await writeFile(
      join(client, "assets/client-routes.json"),
      '["/desktop.html"]',
    );
    await writeFile(
      join(client, "desktop.html"),
      "<title>Synthetic client</title>",
    );
    await writeFile(
      join(vendors, "node_modules/marked/lib/marked.umd.js"),
      "globalThis.syntheticVendor=true;",
    );
    await writeFile(join(vendors, "private.txt"), "synthetic-private-value");
    const serve = await staticClient(client, vendors);
    const vendor = await serve(
      new Request("http://127.0.0.1:9915/vendor/marked.js"),
    );
    expect(vendor?.status).toBe(200);
    expect(vendor?.headers.get("content-type")).toBe("text/javascript");
    expect(await vendor?.text()).toBe("globalThis.syntheticVendor=true;");
    expect(
      (await serve(new Request("http://127.0.0.1:9915/desktop.html")))?.status,
    ).toBe(200);
    expect(
      await serve(new Request("http://127.0.0.1:9915/private.txt")),
    ).toBeNull();
    expect(
      await serve(
        new Request(
          "http://127.0.0.1:9915/node_modules/marked/lib/marked.umd.js",
        ),
      ),
    ).toBeNull();
    const native = await staticClient(client);
    expect(
      await native(new Request("http://127.0.0.1:9915/vendor/marked.js")),
    ).toBeNull();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
