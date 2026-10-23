import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chooseAuxiliaryFiles } from "../../packages/desktop/auxiliary-files.ts";
import type { NativeContext } from "../../packages/desktop/application-types.ts";

test("auxiliary file picker returns only manually selected bytes and names without leaking paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "orvunia-auxiliary-files-"));
  const path = join(directory, "example.png");
  try {
    await writeFile(path, new Uint8Array([137, 80, 78, 71]));
    let canceled = false, selected = 0;
    const context = { abort: new AbortController(), electron: { dialog: {
      async showOpenDialog(_window: unknown, options: { properties: string[] }) {
        expect(options.properties).toContain("multiSelections"); selected++;
        return { canceled, filePaths: canceled ? [] : [path] };
      },
    } } } as unknown as NativeContext;
    const files = await chooseAuxiliaryFiles(context, null, "image/png,image/jpeg", true);
    expect(selected).toBe(1); expect(files).toEqual([{ name: "example.png", type: "image/png", data: "iVBORw==" }]);
    expect(JSON.stringify(files)).not.toContain(directory);
    canceled = true; expect(await chooseAuxiliaryFiles(context, null, "image/png", true)).toEqual([]);
    context.abort.abort(); await expect(chooseAuxiliaryFiles(context, null, "image/png", true)).rejects.toThrow();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
