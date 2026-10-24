import test from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { imageProof } from "../reporting/screenshots.mjs";
function png(width, height, blank = false) {
  const image = new PNG({ width, height });
  if (!blank) for (let index = 0; index < image.data.length; index += 4) {
    const pixel = index / 4;
    image.data[index] = pixel % 251; image.data[index + 1] = Math.floor(pixel / width) % 253;
    image.data[index + 2] = pixel % 127; image.data[index + 3] = 255;
  }
  return PNG.sync.write(image);
}
test("draft screenshot proof binds the original PNG pixels to the actual measured renderer without resizing", () => {
  const bytes = png(1366, 768), value = imageProof(bytes, { width: 1366, height: 768, scale: 1 });
  assert.equal(value.width, 1366); assert.equal(value.height, 768);
  assert.equal(value.resized, false); assert.equal(value.storeSizeEligible, true); assert.ok(value.sampledColors > 8);
  assert.throws(() => imageProof(bytes, { width: 1920, height: 1080, scale: 1 }));
});
test("undersized, blank and non-PNG images cannot qualify as desktop Store-size screenshot drafts", () => {
  assert.throws(() => imageProof(png(1, 1), { width: 1, height: 1, scale: 1 }));
  assert.throws(() => imageProof(png(1366, 768, true), { width: 1366, height: 768, scale: 1 }));
  assert.throws(() => imageProof(Buffer.from("not an image"), { width: 1366, height: 768, scale: 1 }));
});
