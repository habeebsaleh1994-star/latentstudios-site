import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MediaInspector } from "./contracts";
import { fail } from "./validation";
const exec = promisify(execFile);
/** Narrow local adapter: JPEG/PNG only, bounded header check followed by real ImageIO decoding. */
export function headerDimensions(bytes: Uint8Array, mime: string) {
  const b = Buffer.from(bytes);
  let width = 0,
    height = 0;
  if (mime === "image/png") {
    if (
      b.length < 45 ||
      b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      b.toString("ascii", 12, 16) !== "IHDR" ||
      b.readUInt32BE(8) !== 13
    )
      fail("MEDIA", "Invalid PNG header.");
    width = b.readUInt32BE(16);
    height = b.readUInt32BE(20);
    let ended = false;
    for (let at = 8; at + 12 <= b.length; ) {
      const size = b.readUInt32BE(at),
        type = b.toString("ascii", at + 4, at + 8);
      if (size > b.length - at - 12) fail("MEDIA", "Truncated PNG chunk.");
      if (type === "acTL")
        fail("MEDIA", "Animated PNG needs a dedicated inspector.");
      at += size + 12;
      if (type === "IEND") {
        if (size !== 0 || at !== b.length) fail("MEDIA", "Invalid PNG ending.");
        ended = true;
        break;
      }
    }
    if (!ended) fail("MEDIA", "Missing PNG ending.");
  } else if (mime === "image/jpeg") {
    if (
      b.length < 8 ||
      b[0] !== 255 ||
      b[1] !== 216 ||
      b[b.length - 2] !== 255 ||
      b[b.length - 1] !== 217
    )
      fail("MEDIA", "Invalid JPEG boundary.");
    for (let at = 2; at + 4 < b.length; ) {
      if (b[at++] !== 255) fail("MEDIA", "Invalid JPEG marker.");
      while (b[at] === 255) at++;
      const marker = b[at++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const size = b.readUInt16BE(at);
      if (size < 2 || at + size > b.length)
        fail("MEDIA", "Truncated JPEG segment.");
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (size < 8) fail("MEDIA", "Invalid JPEG dimensions.");
        height = b.readUInt16BE(at + 3);
        width = b.readUInt16BE(at + 5);
        break;
      }
      at += size;
    }
  } else fail("MEDIA", "This local inspector supports JPEG and PNG only.");
  if (!width || !height || width * height > 32000000)
    fail(
      "MEDIA",
      "Image exceeds the 32 megapixel limit or has invalid dimensions.",
    );
  return { width, height };
}
export class MacRasterInspector implements MediaInspector {
  async inspect(bytes: Uint8Array, mime: string) {
    headerDimensions(bytes, mime);
    const folder = await mkdtemp(join(tmpdir(), "latent-raster-check-"));
    try {
      const input = join(
          folder,
          mime === "image/jpeg" ? "input.jpg" : "input.png",
        ),
        output = join(folder, "decoded.png");
      await writeFile(input, bytes, { mode: 0o600 });
      await exec(
        "/usr/bin/sips",
        ["-s", "format", "png", input, "--out", output],
        { timeout: 15000, maxBuffer: 64 * 1024 },
      );
      return headerDimensions(await readFile(output), "image/png");
    } catch {
      return fail(
        "MEDIA",
        "Media could not be fully decoded by the local image inspector.",
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
