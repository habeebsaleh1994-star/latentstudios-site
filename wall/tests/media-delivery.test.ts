import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISPLAY_RECIPE,
  cachedDisplay,
  displayDimensions,
  hashBlob,
  isAnimated,
  prepareDisplay,
} from "../src/mediaDelivery";
import { crc32, websiteZip } from "../src/zip";
import { portablePackage } from "../src/portable";
import { initialSite } from "../src/model";
import type { Revision } from "../src/revisions";
beforeEach(async () => {
  const db = await openDB("latent-studio-display-cache-v1", 1, {
    upgrade(db) {
      db.createObjectStore("copies");
    },
  });
  await db.clear("copies");
  db.close();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function encoder(width: number, height: number, encodedBytes = 60) {
  const draw = vi.fn(),
    close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height, close })),
  );
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: draw }),
      toBlob: (callback: (b: Blob) => void, type: string) =>
        callback(new Blob([new Uint8Array(encodedBytes)], { type })),
    }),
  });
  return { draw, close };
}
describe("original-preserving image delivery", () => {
  it("fits landscape and portrait without enlarging or distorting the original", () => {
    expect(displayDimensions(4000, 3000, 2400)).toEqual({
      width: 2400,
      height: 1800,
    });
    expect(displayDimensions(2000, 4000, 1280)).toEqual({
      width: 640,
      height: 1280,
    });
    expect(displayDimensions(120, 80, 640)).toEqual({ width: 120, height: 80 });
    expect(() => displayDimensions(0, 1, 640)).toThrow();
  });
  it("recognizes animation chunks without flattening GIF, APNG or animated WebP", () => {
    const png = new Uint8Array(20);
    png.set(new TextEncoder().encode("acTL"), 12);
    expect(isAnimated(png, "image/png")).toBe(true);
    const webp = new Uint8Array(20);
    webp.set(new TextEncoder().encode("ANIM"), 12);
    expect(isAnimated(webp, "image/webp")).toBe(true);
    expect(isAnimated(new Uint8Array(), "image/gif")).toBe(true);
    expect(isAnimated(new Uint8Array(20), "image/jpeg")).toBe(false);
  });
  it("creates bounded whole-image copies with orientation handling, preserves bytes and reuses the recipe cache", async () => {
    const { draw, close } = encoder(4000, 2000);
    const blob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" }),
      hash = await hashBlob(blob);
    const r = await prepareDisplay(blob);
    expect(r.recipe).toBe(DISPLAY_RECIPE);
    expect(r.variants.map((v) => [v.width, v.height])).toEqual([
      [640, 320],
      [1280, 640],
      [2400, 1200],
    ]);
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 2400, 1200);
    expect(close).toHaveBeenCalledOnce();
    expect(await hashBlob(blob)).toBe(hash);
    expect(await cachedDisplay(blob)).toEqual(r);
    await prepareDisplay(blob);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(createImageBitmap).toHaveBeenCalledWith(blob, {
      imageOrientation: "from-image",
      colorSpaceConversion: "default",
    });
  });
  it("keeps smaller originals and animated files, with a durable reason", async () => {
    encoder(500, 300, 500);
    const small = new Blob([new Uint8Array(100)], { type: "image/png" });
    const record = await prepareDisplay(small);
    expect(record.variants).toHaveLength(0);
    expect(record.reason).toContain("already smaller");
    const bytes = new Uint8Array(20);
    bytes.set(new TextEncoder().encode("acTL"), 12);
    const animated = new Blob([bytes], { type: "image/png" });
    const kept = await prepareDisplay(animated);
    expect(kept.reason).toContain("Animation");
    expect((await cachedDisplay(animated))?.reason).toBe(kept.reason);
  });
  it("does not cache cancelled or failed encodes", async () => {
    encoder(4000, 2000);
    const abort = new AbortController();
    abort.abort();
    const blob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" });
    await expect(prepareDisplay(blob, abort.signal)).rejects.toThrow();
    expect(await cachedDisplay(blob)).toBeUndefined();
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({ drawImage: () => {} }),
        toBlob: (cb: (b: null) => void) => cb(null),
      }),
    });
    await expect(prepareDisplay(blob)).rejects.toThrow("encoding failed");
    expect(await cachedDisplay(blob)).toBeUndefined();
  });
  it("retains film and vector originals without invoking raster decoding", async () => {
    encoder(2000, 1000);
    for (const type of ["video/mp4", "image/svg+xml"]) {
      const r = await prepareDisplay(new Blob(["original"], { type }));
      expect(r.variants).toHaveLength(0);
    }
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
  it("leaves originals intact when the derivative cache is full and permits a later retry", async () => {
    encoder(1600, 1000);
    const blob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" });
    const before = await hashBlob(blob);
    const write = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementationOnce(() => {
        throw new DOMException("Cache quota exceeded", "QuotaExceededError");
      });
    await expect(prepareDisplay(blob)).rejects.toThrow("Cache quota exceeded");
    expect(await cachedDisplay(blob)).toBeUndefined();
    expect(await hashBlob(blob)).toBe(before);
    write.mockRestore();
    expect((await prepareDisplay(blob)).variants).toHaveLength(3);
  });
});
describe("portable separate-file packages", () => {
  it("writes valid stored ZIP headers, byte lengths, CRC and central directory offsets", async () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const zip = await websiteZip([
      { name: "index.html", blob: new Blob(["hello"]) },
      { name: "media/a.bin", blob: new Blob([new Uint8Array([0, 255, 10])]) },
    ]);
    const b = new Uint8Array(await zip.arrayBuffer()),
      v = new DataView(b.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(8, true)).toBe(0);
    const n = v.getUint16(26, true);
    expect(new TextDecoder().decode(b.slice(30 + n, 35 + n))).toBe("hello");
    const end = b.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    expect(v.getUint32(v.getUint32(end + 16, true), true)).toBe(0x02014b50);
  });
  it("refuses duplicate and escaping archive paths", async () => {
    for (const name of [
      "../a",
      "/absolute",
      "media/../../a",
      "media/./a",
      "media//a",
    ])
      await expect(websiteZip([{ name, blob: new Blob() }])).rejects.toThrow();
    await expect(
      websiteZip([
        { name: "a", blob: new Blob() },
        { name: "a", blob: new Blob() },
      ]),
    ).rejects.toThrow();
  });
  it("exports responsive relative assets and provenance without embedding originals or base64", async () => {
    encoder(4000, 2000);
    const blob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" });
    await prepareDisplay(blob);
    const site = structuredClone(initialSite);
    site.pages = site.pages.map((p) => ({
      ...p,
      blocks: p.blocks.filter((b) => b.type === "text"),
    }));
    site.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: "photo",
      focal: { x: 23, y: 82 },
      fit: "portrait",
    });
    const r: Revision = {
      format: "latent-studio-revision",
      version: 1,
      id: "fixture",
      name: "Fixture",
      createdAt: "",
      sourceRevision: 1,
      site,
      assets: { photo: blob },
      manifest: [
        { id: "photo", type: blob.type, bytes: blob.size, missing: false },
      ],
    };
    const result = await portablePackage(r, "web");
    const text = new TextDecoder().decode(await result.blob.arrayBuffer());
    const payload = JSON.parse(
      text.match(
        /<script id="latent-document" type="application\/json">(.*?)<\/script>/s,
      )![1],
    );
    expect(payload.assets.photo.src.startsWith("media/")).toBe(true);
    expect(
      payload.assets.photo.srcSet
        .split(", ")
        .every((entry: string) => entry.startsWith("media/")),
    ).toBe(true);
    expect(text).toContain("srcSet");
    expect(result.receipt.originalBytes).toBe(1000);
    expect(result.receipt.assets[0].files.map((v) => v.width)).toEqual([
      640, 1280, 2400,
    ]);
    expect(text).toContain('"focal":{"x":23,"y":82}');
    expect(text).toContain('"fit":"portrait"');
    expect(await hashBlob(r.assets.photo)).toBe(
      result.receipt.assets[0].originalHash,
    );
  });
});
