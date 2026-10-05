export interface ZipEntry {
  name: string;
  blob: Blob;
}
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** Stored ZIP entries: compressed media is not expanded into base64 or recompressed. */
export async function websiteZip(entries: ZipEntry[]) {
  const seen = new Set<string>();
  let offset = 0;
  const local: BlobPart[] = [],
    central: BlobPart[] = [];
  if (entries.length > 10000)
    throw new Error("Too many files for this local package.");
  for (const entry of entries) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(entry.name) ||
      entry.name.startsWith("/") ||
      entry.name
        .split("/")
        .some((part) => !part || part === ".." || part === ".") ||
      seen.has(entry.name)
    )
      throw new Error("Unsafe or duplicate package path.");
    seen.add(entry.name);
    const name = new TextEncoder().encode(entry.name),
      bytes = new Uint8Array(await entry.blob.arrayBuffer()),
      crc = crc32(bytes);
    if (offset + bytes.length > 120 * 1024 * 1024)
      throw new Error("The local website package exceeds 120 MB.");
    const header = new Uint8Array(30 + name.length),
      h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(10, 0, true);
    h.setUint16(12, 33, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, bytes.length, true);
    h.setUint32(22, bytes.length, true);
    h.setUint16(26, name.length, true);
    header.set(name, 30);
    const directory = new Uint8Array(46 + name.length),
      d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint16(14, 33, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, bytes.length, true);
    d.setUint32(24, bytes.length, true);
    d.setUint16(28, name.length, true);
    d.setUint32(42, offset, true);
    directory.set(name, 46);
    local.push(header, entry.blob);
    central.push(directory);
    offset += header.length + bytes.length;
  }
  const directorySize = central.reduce(
    (n, part) => n + (part as Uint8Array).byteLength,
    0,
  );
  const end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  return new Blob([...local, ...central, end], { type: "application/zip" });
}
