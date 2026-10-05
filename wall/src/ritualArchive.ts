import { ritualManifestSchema, type RitualManifest } from "./ritualContract";
const MB = 1024 * 1024;
const fail = (message: string): never => {
  throw new Error(message + " No draft was changed.");
};
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
// v1 intentionally admits only the tiny stored-ZIP dialect emitted by Ritual.
export function readPublicationZIP(
  bytes: Uint8Array<ArrayBuffer>,
): Map<string, Uint8Array<ArrayBuffer>> {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    n = bytes.length;
  if (n < 22 || n > 80 * MB)
    fail("Choose a complete Story ZIP smaller than 80 MB.");
  const end = n - 22;
  if (
    d.getUint32(end, true) !== 0x06054b50 ||
    d.getUint16(end + 4, true) ||
    d.getUint16(end + 6, true) ||
    d.getUint16(end + 20, true)
  )
    fail("Unsupported or malformed ZIP ending.");
  const count = d.getUint16(end + 10, true),
    start = d.getUint32(end + 16, true);
  if (
    count < 2 ||
    count > 101 ||
    d.getUint16(end + 8, true) !== count ||
    start + d.getUint32(end + 12, true) !== end
  )
    fail("Invalid ZIP directory.");
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  let cursor = start,
    local = 0;
  const decode = (a: Uint8Array) => {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(a);
    } catch {
      return fail("Invalid ZIP filename encoding.");
    }
  };
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || d.getUint32(cursor, true) !== 0x02014b50)
      fail("Truncated ZIP directory.");
    const len = d.getUint16(cursor + 28, true),
      size = d.getUint32(cursor + 24, true),
      crc = d.getUint32(cursor + 16, true),
      offset = d.getUint32(cursor + 42, true);
    if (
      cursor + 46 + len > end ||
      d.getUint16(cursor + 8, true) ||
      d.getUint16(cursor + 10, true) ||
      d.getUint16(cursor + 30, true) ||
      d.getUint16(cursor + 32, true) ||
      d.getUint16(cursor + 34, true) ||
      d.getUint32(cursor + 38, true) ||
      d.getUint32(cursor + 20, true) !== size ||
      offset !== local
    )
      fail(
        "Compressed, linked, overlapping or extended ZIP entries are unsupported.",
      );
    const name = decode(bytes.subarray(cursor + 46, cursor + 46 + len));
    if (
      !/^(story\.json|media\/[0-9a-f-]{36}\.png)$/.test(name) ||
      files.has(name)
    )
      fail("Unsafe, duplicated or unsupported ZIP path.");
    if (
      size > (name === "story.json" ? MB : 30 * MB) ||
      offset + 30 + len + size > start
    )
      fail("A ZIP entry exceeds its size limit or is truncated.");
    if (
      d.getUint32(offset, true) !== 0x04034b50 ||
      d.getUint16(offset + 6, true) ||
      d.getUint16(offset + 8, true) ||
      d.getUint32(offset + 14, true) !== crc ||
      d.getUint32(offset + 18, true) !== size ||
      d.getUint32(offset + 22, true) !== size ||
      d.getUint16(offset + 26, true) !== len ||
      d.getUint16(offset + 28, true) ||
      decode(bytes.subarray(offset + 30, offset + 30 + len)) !== name
    )
      fail("ZIP headers disagree.");
    const content = bytes.slice(offset + 30 + len, offset + 30 + len + size);
    if (crc32(content) !== crc)
      fail("A package file is damaged (CRC mismatch).");
    files.set(name, content);
    local = offset + 30 + len + size;
    cursor += 46 + len;
  }
  if (cursor !== end || local !== start || !files.has("story.json"))
    fail("The ZIP contains unexplained or missing content.");
  return files;
}
// Reject ambiguous JSON objects, including escaped spellings of a duplicate key.
export function parseUnambiguousJSON(text: string): unknown {
  const keys: Set<string>[] = [],
    last: string[] = [];
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}[\]:,]|[^\s{}[\]:,]+/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "{") {
      keys.push(new Set());
      last.push("object");
    } else if (t === "[") last.push("array");
    else if (t === "}") {
      keys.pop();
      last.pop();
    } else if (t === "]") last.pop();
    else if (
      t.startsWith('"') &&
      tokens[i + 1] === ":" &&
      last.at(-1) === "object"
    ) {
      const key = JSON.parse(t) as string,
        set = keys.at(-1);
      if (set?.has(key)) fail("The manifest contains duplicate JSON keys.");
      set?.add(key);
    }
  }
  return JSON.parse(text) as unknown;
}
export function validatePNG(
  bytes: Uint8Array<ArrayBuffer>,
  asset: RitualManifest["assets"][number],
) {
  if (
    bytes.length < 57 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    fail("A Story photograph is not a PNG.");
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8,
    header = false,
    srgb = false,
    data = false,
    ended = false;
  while (p + 12 <= bytes.length) {
    const len = d.getUint32(p),
      end = p + 12 + len;
    if (end > bytes.length) fail("A PNG is truncated.");
    const type = new TextDecoder().decode(bytes.subarray(p + 4, p + 8));
    if (!["IHDR", "sRGB", "IDAT", "IEND"].includes(type))
      fail(
        "PNG contains unsupported metadata or animation. Export a fresh Story package from Ritual.",
      );
    if (crc32(bytes.subarray(p + 4, end - 4)) !== d.getUint32(end - 4))
      fail("PNG integrity check failed.");
    if (type === "IHDR") {
      if (
        header ||
        p !== 8 ||
        len !== 13 ||
        d.getUint32(p + 8) !== asset.width ||
        d.getUint32(p + 12) !== asset.height ||
        bytes[p + 16] !== 8 ||
        ![2, 6].includes(bytes[p + 17]) ||
        bytes[p + 18] ||
        bytes[p + 19] ||
        bytes[p + 20]
      )
        fail("Unsupported PNG dimensions or encoding.");
      header = true;
    } else if (type === "sRGB") {
      if (!header || srgb || data || len !== 1 || bytes[p + 8] !== 0)
        fail("Invalid sRGB marker.");
      srgb = true;
    } else if (type === "IDAT") {
      if (!header || !srgb || ended) fail("Invalid PNG pixel ordering.");
      data = true;
    } else if (type === "IEND") {
      if (!data || len || end !== bytes.length) fail("Invalid PNG ending.");
      ended = true;
    }
    p = end;
  }
  if (!header || !srgb || !data || !ended || p !== bytes.length)
    fail("Incomplete publication PNG.");
}
export interface AdmittedStory {
  manifest: RitualManifest;
  assets: Record<string, Blob>;
  packageSha256: string;
}
export async function decodePublication(
  file: Blob,
  probe: (blob: Blob, width: number, height: number) => Promise<void> = async (
    blob,
    w,
    h,
  ) => {
    const image = await createImageBitmap(blob);
    try {
      if (image.width !== w || image.height !== h)
        throw new Error("Decoded image size disagrees.");
    } finally {
      image.close();
    }
  },
): Promise<AdmittedStory> {
  if (file.size > 80 * MB) fail("This Story package exceeds 80 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    files = readPublicationZIP(bytes);
  let manifest: RitualManifest;
  try {
    manifest = ritualManifestSchema.parse(
      parseUnambiguousJSON(
        new TextDecoder("utf-8", { fatal: true }).decode(
          files.get("story.json"),
        ),
      ),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate JSON"))
      throw error;
    return fail(
      "Unsupported or invalid Story manifest. Version 1 with public fields only is required.",
    );
  }
  if (manifest.assets.reduce((sum, a) => sum + a.bytes, 0) > 60 * MB)
    fail(
      "Story media exceed the 60 MB local website limit. Export fewer or smaller photographs.",
    );
  if (files.size !== manifest.assets.length + 1)
    fail("Missing or unlisted Story media.");
  const assets: Record<string, Blob> = Object.create(null);
  for (const asset of manifest.assets) {
    const data = files.get(asset.path);
    if (!data) fail("Missing Story photograph: " + asset.path);
    if (data!.length !== asset.bytes || (await sha256(data!)) !== asset.sha256)
      fail("Story media size or SHA-256 does not match.");
    validatePNG(data!, asset);
    const blob = new Blob([data!], { type: "image/png" });
    try {
      await probe(blob, asset.width, asset.height);
    } catch {
      fail("A Story photograph could not be decoded.");
    }
    assets[asset.id] = blob;
  }
  return { manifest, assets, packageSha256: await sha256(bytes) };
}
