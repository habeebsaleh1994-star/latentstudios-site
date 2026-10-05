import { openDB } from "idb";
export const DISPLAY_RECIPE = "srgb-webp-q88-longedge-v1";
export const DISPLAY_EDGES = [640, 1280, 2400] as const;
export interface DisplayVariant {
  blob: Blob;
  width: number;
  height: number;
}
export interface DisplayRecord {
  key: string;
  sourceHash: string;
  recipe: string;
  originalBytes: number;
  originalType: string;
  width: number;
  height: number;
  variants: DisplayVariant[];
  reason?: string;
}
export const hashBlob = async (blob: Blob) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
const cacheDB = () =>
  openDB("latent-studio-display-cache-v1", 1, {
    upgrade(db) {
      db.createObjectStore("copies");
    },
  });
export async function cachedDisplay(
  blob: Blob,
): Promise<DisplayRecord | undefined> {
  const hash = await hashBlob(blob);
  return (await cacheDB()).get("copies", `${DISPLAY_RECIPE}:${hash}`);
}
export function displayDimensions(width: number, height: number, edge: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(edge) ||
    edge <= 0
  )
    throw new Error("Invalid image dimensions.");
  const scale = Math.min(1, edge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export function isAnimated(bytes: Uint8Array, type: string) {
  if (type === "image/gif") return true;
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === "image/png")
    for (let at = 8; at + 12 <= bytes.length; ) {
      const size = view.getUint32(at);
      if (ascii(at + 4, at + 8) === "acTL") return true;
      if (size > bytes.length - at - 12) break;
      at += size + 12;
    }
  if (type === "image/webp")
    for (let at = 12; at + 8 <= bytes.length; ) {
      const size = view.getUint32(at + 4, true);
      if (["ANIM", "ANMF"].includes(ascii(at, at + 4))) return true;
      if (size > bytes.length - at - 8) break;
      at += 8 + size + (size % 2);
    }
  return false;
}
async function decode(blob: Blob, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const bitmapPromise = createImageBitmap(blob, {
    imageOrientation: "from-image",
    colorSpaceConversion: "default",
  });
  return new Promise<ImageBitmap>((resolve, reject) => {
    let finished = false;
    const stop = (error: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(error);
    };
    const abort = () =>
      stop(new DOMException("Image preparation cancelled.", "AbortError"));
    const timer = setTimeout(
      () => stop(new Error("Image decoding timed out.")),
      15000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    bitmapPromise.then(
      (bitmap) => {
        if (finished) {
          bitmap.close();
          return;
        }
        finished = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        resolve(bitmap);
      },
      (e) => stop(e),
    );
  });
}
export async function prepareDisplay(
  blob: Blob,
  signal?: AbortSignal,
): Promise<DisplayRecord> {
  signal?.throwIfAborted();
  const sourceHash = await hashBlob(blob),
    key = `${DISPLAY_RECIPE}:${sourceHash}`;
  const db = await cacheDB();
  const existing: DisplayRecord | undefined = await db.get("copies", key);
  if (existing) return existing;
  const base = {
    key,
    sourceHash,
    recipe: DISPLAY_RECIPE,
    originalBytes: blob.size,
    originalType: blob.type,
    width: 0,
    height: 0,
    variants: [],
  } satisfies DisplayRecord;
  async function retain(reason: string, width = 0, height = 0) {
    const record = { ...base, width, height, reason };
    signal?.throwIfAborted();
    await db.put("copies", record, key);
    return record;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
    return retain(
      blob.type.startsWith("video/")
        ? "Film original retained; no transcoding."
        : "Vector or animated original retained.",
    );
  if (isAnimated(new Uint8Array(await blob.arrayBuffer()), blob.type))
    return retain("Animation retained in the original.");
  const bitmap = await decode(blob, signal);
  try {
    if (bitmap.width * bitmap.height > 32_000_000)
      return retain(
        "Above the 32 megapixel display-copy limit; original retained.",
        bitmap.width,
        bitmap.height,
      );
    const variants: DisplayVariant[] = [];
    let previous = 0;
    for (const edge of DISPLAY_EDGES) {
      signal?.throwIfAborted();
      const size = displayDimensions(bitmap.width, bitmap.height, edge);
      if (size.width === previous) continue;
      previous = size.width;
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d", {
        alpha: true,
        colorSpace: "srgb",
      });
      if (!context)
        throw new Error("This browser cannot prepare display copies.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const result = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.88),
      );
      canvas.width = 1;
      canvas.height = 1;
      signal?.throwIfAborted();
      if (!result)
        throw new Error("Image encoding failed; the original is unchanged.");
      if (result.type === "image/webp" && result.size < blob.size * 0.96)
        variants.push({ blob: result, ...size });
    }
    const record: DisplayRecord = {
      ...base,
      width: bitmap.width,
      height: bitmap.height,
      variants,
      reason: variants.length
        ? undefined
        : "The original is already smaller; no larger copy was kept.",
    };
    signal?.throwIfAborted();
    await db.put("copies", record, key);
    return record;
  } finally {
    bitmap.close();
  }
}
export const displayBytes = (record: DisplayRecord) =>
  record.variants.at(-1)?.blob.size ?? record.originalBytes;
