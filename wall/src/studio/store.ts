/*
 * Where a Studio document and its images live in the browser.
 *
 * Same shape as the engine's database (a `documents` store keyed by name with a revision, and an
 * `assets` store of image files), so the editor can be pointed at it later. A save names the
 * revision it was based on; if another tab has saved since, the save is refused rather than
 * overwriting it.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { StoredDocument } from "../database";
import { studioSchema, type StudioDocument } from "./document";

const LEGACY_KEY = "studio-v14";
const keyFor = (name: string) => `${LEGACY_KEY}:${name}`;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 30 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

/** Images are kept as raw bytes, not file objects: Safari is unreliable at storing files in IndexedDB (and refuses them in private windows). Files stored by an earlier version are still read. */
export type StoredImage = { type: string; data: ArrayBuffer };
export interface RoomsDB extends DBSchema {
  documents: { key: string; value: StoredDocument };
  assets: { key: string; value: StoredImage | Blob };
}
const sizeOf = (v: StoredImage | Blob) => (v instanceof Blob ? v.size : v.data.byteLength);

export class StaleRevisionError extends Error {
  constructor() { super("This site was changed in another tab. Reload to see the latest."); this.name = "StaleRevisionError"; }
}
export type Open = () => Promise<IDBPDatabase<RoomsDB>>;
const defaultOpen: Open = () =>
  openDB<RoomsDB>("latent-studio-rooms-v14", 1, {
    upgrade(db) { db.createObjectStore("documents"); db.createObjectStore("assets"); },
  });

export const isStoredAsset = (assetId: string) => assetId.startsWith("asset:");

export function createStudioStore(open: Open = defaultOpen) {
  /**
   * Each template keeps its own document under its own name. A stored document is used only if the
   * template accepts it (it has the page that template needs); otherwise the template starts from its seed.
   * Documents saved before names existed sat in one shared slot; the first template that accepts one takes it.
   */
  async function load(seed: unknown, name: string, accepts: (d: StudioDocument) => boolean = () => true): Promise<{ doc: StudioDocument; revision: number; seeded: boolean }> {
    const db = await open();
    const key = keyFor(name);
    const rec = await db.get("documents", key);
    if (rec) {
      const parsed = studioSchema.safeParse(rec.value);
      if (parsed.success && accepts(parsed.data)) return { doc: parsed.data, revision: rec.revision, seeded: false };
    }
    const legacy = await db.get("documents", LEGACY_KEY);
    if (legacy) {
      const parsed = studioSchema.safeParse(legacy.value);
      if (parsed.success && accepts(parsed.data)) {
        await db.put("documents", { value: parsed.data, revision: legacy.revision }, key);
        await db.delete("documents", LEGACY_KEY);
        return { doc: parsed.data, revision: legacy.revision, seeded: false };
      }
    }
    const doc = studioSchema.parse(seed);
    const revision = (rec?.revision ?? 0) + 1;
    await db.put("documents", { value: doc, revision }, key);
    return { doc, revision, seeded: true };
  }

  async function save(doc: StudioDocument, basedOn: number, name: string): Promise<number> {
    const value = studioSchema.parse(doc);
    const db = await open();
    const tx = db.transaction("documents", "readwrite");
    const key = keyFor(name);
    const rec = await tx.store.get(key);
    if (rec && rec.revision !== basedOn) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new StaleRevisionError();
    }
    const revision = (rec?.revision ?? 0) + 1;
    await tx.store.put({ value, revision }, key);
    await tx.done;
    return revision;
  }

  async function putImage(file: Blob): Promise<string> {
    if (!IMAGE_TYPES.includes(file.type)) throw new Error("Choose a JPG, PNG, WebP or GIF image.");
    if (file.size > MAX_BYTES) throw new Error("Images up to 30 MB are supported.");
    return keep(file);
  }

  /** Films are kept the same way as images. This browser prototype takes MP4 or WebM up to 80 MB; real hosting comes later. */
  async function putVideo(file: Blob): Promise<string> {
    if (!VIDEO_TYPES.includes(file.type)) throw new Error("Choose an MP4 or WebM film.");
    if (file.size > MAX_VIDEO_BYTES) throw new Error("Films up to 80 MB are supported here.");
    return keep(file);
  }

  async function keep(file: Blob): Promise<string> {
    const id = crypto.randomUUID();
    const data = await file.arrayBuffer();
    const db = await open();
    try {
      await db.put("assets", { type: file.type, data }, id);
    } catch {
      throw new Error("This browser could not keep the image. If this is a private window, open the site in a normal window.");
    }
    return `asset:${id}`;
  }

  async function readImage(assetId: string): Promise<Blob | undefined> {
    if (!isStoredAsset(assetId)) return undefined;
    const db = await open();
    const v = await db.get("assets", assetId.slice("asset:".length));
    if (!v) return undefined;
    return v instanceof Blob ? v : new Blob([v.data], { type: v.type });
  }

  /** Remove stored images that no document uses. Looks at every stored document, since templates share the media store. Run on load, never mid-session, so Undo stays safe. */
  async function prune(): Promise<number> {
    const db = await open();
    const used = new Set<string>();
    for (const rec of await db.getAll("documents")) {
      const parsed = studioSchema.safeParse(rec.value);
      if (!parsed.success) { return 0; } // never delete when a document cannot be read
      for (const p of parsed.data.pages) for (const b of p.blocks) if (isStoredAsset(b.assetId)) used.add(b.assetId.slice("asset:".length));
    }
    const keys = (await db.getAllKeys("assets")) as string[];
    const gone = keys.filter((k) => !used.has(k));
    await Promise.all(gone.map((k) => db.delete("assets", k)));
    return gone.length;
  }

  async function usage(): Promise<{ images: number; bytes: number }> {
    const db = await open();
    const all = await db.getAll("assets");
    return { images: all.length, bytes: all.reduce((n, v) => n + sizeOf(v), 0) };
  }

  /** Start again from the seed. Dev and "restore the original" only. */
  async function reset(seed: unknown, name: string): Promise<{ doc: StudioDocument; revision: number }> {
    const db = await open();
    const key = keyFor(name);
    const rec = await db.get("documents", key);
    const doc = studioSchema.parse(seed);
    const revision = (rec?.revision ?? 0) + 1;
    await db.put("documents", { value: doc, revision }, key);
    await prune();
    return { doc, revision };
  }

  return { load, save, putImage, putVideo, readImage, prune, usage, reset };
}
export type StudioStore = ReturnType<typeof createStudioStore>;
