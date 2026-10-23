import { AssetError } from "./domain.ts";

export function imageMime(data: Uint8Array) {
  if (!data.length || data.byteLength > 4 * 1024 * 1024)
    throw new AssetError("invalid_image");
  const bytes = Buffer.from(data);
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  throw new AssetError("invalid_image");
}
