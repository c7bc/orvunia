import { deflateRawSync } from "node:zlib";

export function documentZip(
  entries: { name: string; body: Buffer; declared?: number }[],
) {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let position = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      compressed = deflateRawSync(entry.body);
    const header = Buffer.alloc(30),
      directory = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(entry.declared ?? entry.body.length, 22);
    header.writeUInt16LE(name.length, 26);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(entry.declared ?? entry.body.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(position, 42);
    local.push(header, name, compressed);
    central.push(directory, name);
    position += header.length + name.length + compressed.length;
  }
  const end = Buffer.alloc(22),
    index = Buffer.concat(central);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(position, 16);
  return Buffer.concat([...local, index, end]);
}
