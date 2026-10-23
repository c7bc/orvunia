import { inflateRawSync } from "node:zlib";

const maximumEntry = 16 * 1024 * 1024;
const maximumExpanded = 32 * 1024 * 1024;
const invalid = () => {
  throw Error("invalid_document");
};

export function validateDocumentZip(buffer: Buffer) {
  let end = -1;
  for (
    let offset = buffer.length - 22;
    offset >= Math.max(0, buffer.length - 65557);
    offset--
  ) {
    if (
      buffer.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6))
    invalid();
  const count = buffer.readUInt16LE(end + 10),
    size = buffer.readUInt32LE(end + 12);
  let offset = buffer.readUInt32LE(end + 16),
    expanded = 0;
  if (
    !count ||
    count > 2000 ||
    count !== buffer.readUInt16LE(end + 8) ||
    offset + size !== end
  )
    invalid();
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
      invalid();
    const flags = buffer.readUInt16LE(offset + 8),
      method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20),
      declared = buffer.readUInt32LE(offset + 24);
    const nameBytes = buffer.readUInt16LE(offset + 28),
      extra = buffer.readUInt16LE(offset + 30),
      comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      declared > maximumEntry ||
      offset + 46 + nameBytes + extra + comment > end
    )
      invalid();
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameBytes)
      .toString("utf8");
    if (
      !name ||
      names.has(name) ||
      name.includes("\\") ||
      name.startsWith("/") ||
      name.split("/").includes("..")
    )
      invalid();
    names.add(name);
    if (
      local + 30 > offset ||
      buffer.readUInt32LE(local) !== 0x04034b50 ||
      buffer.readUInt16LE(local + 8) !== method ||
      buffer.readUInt16LE(local + 6) !== flags
    )
      invalid();
    const localName = buffer.readUInt16LE(local + 26),
      localExtra = buffer.readUInt16LE(local + 28);
    if (
      localName !== nameBytes ||
      !buffer
        .subarray(local + 30, local + 30 + localName)
        .equals(buffer.subarray(offset + 46, offset + 46 + nameBytes))
    )
      invalid();
    const start = local + 30 + localName + localExtra,
      stop = start + compressed;
    if (stop > offset || start > stop) invalid();
    const payload = buffer.subarray(start, stop);
    const actual =
      method === 0
        ? payload
        : inflateRawSync(payload, { maxOutputLength: maximumEntry });
    if (
      actual.length !== declared ||
      (expanded += actual.length) > maximumExpanded
    )
      invalid();
    offset += 46 + nameBytes + extra + comment;
  }
  if (offset !== end) invalid();
}
