/*
 * Where the artist's site and photographs live in this browser.
 *
 * One site per space (the default space is the artist's; studies and tests use their own).
 * Every save carries a revision. A save based on an older revision than the stored one is refused,
 * and every other open window is told about each save, so a window left open can never write an
 * old copy over a newer one: the cause of "I deleted it and it came back".
 *
 * Photographs are kept as raw bytes (Safari will not reliably store file objects), sized down to
 * 2400 px on the long edge. Their ids start with "asset:".
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { siteSchema, type SiteDocument } from "../studio/site";
import { readMeta } from "./meta";

interface Rec { value: unknown; revision: number }
interface WallDB extends DBSchema {
  sites: { key: string; value: Rec };
  assets: { key: string; value: { type: string; data: ArrayBuffer } };
}
export class StaleError extends Error { constructor() { super("This site was changed in another window."); this.name = "StaleError"; } }

const MAX_BYTES = 15 * 1024 * 1024, LONG_EDGE = 2400;
let dbp: Promise<IDBPDatabase<WallDB>> | null = null;
const db = () => (dbp ??= openDB<WallDB>("latent-wall", 1, { upgrade(d) { d.createObjectStore("sites"); d.createObjectStore("assets"); } }));

export function createStore(space = "artist") {
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(`latent-wall:${space}`) : null;
  const urls = new Map<string, string>();

  async function load(): Promise<{ site: SiteDocument; revision: number } | null> {
    const rec = await (await db()).get("sites", space);
    if (!rec) return null;
    const parsed = siteSchema.safeParse(rec.value);
    return parsed.success ? { site: parsed.data, revision: rec.revision } : null;
  }

  async function save(site: SiteDocument, basedOn: number): Promise<number> {
    const value = siteSchema.parse(site);
    const tx = (await db()).transaction("sites", "readwrite");
    const rec = await tx.store.get(space);
    if (rec && rec.revision !== basedOn) { tx.abort(); await tx.done.catch(() => {}); throw new StaleError(); }
    const revision = (rec?.revision ?? 0) + 1;
    await tx.store.put({ value, revision }, space);
    await tx.done;
    channel?.postMessage({ revision });
    return revision;
  }

  /** Called with the newer site whenever another window saves. */
  function onOther(fn: (site: SiteDocument, revision: number) => void) {
    channel?.addEventListener("message", async () => { const r = await load(); if (r) fn(r.site, r.revision); });
  }

  /** A file from the computer, ready for the library: what it says about itself read first, then sized, kept and measured. */
  async function putImage(file: File): Promise<{ id: string; w: number; h: number; title: string; caption?: string; date?: string; taken?: string; name: string }> {
    if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) throw new Error(`${file.name} is not an image.`);
    if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 15 MB.`);
    const meta = readMeta(await file.arrayBuffer());
    const bmp = await createImageBitmap(file).catch(() => { throw new Error(`${file.name} could not be read by this browser.`); });
    const s = Math.min(1, LONG_EDGE / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d")!.drawImage(bmp, 0, 0, w, h); bmp.close();
    const blob = await new Promise<Blob>((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("The image could not be prepared."))), "image/jpeg", 0.9));
    const id = crypto.randomUUID();
    try { await (await db()).put("assets", { type: blob.type, data: await blob.arrayBuffer() }, id); }
    catch { throw new Error("This browser could not keep the photograph. In a private window, open the site in a normal one."); }
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    return { id: `asset:${id}`, w, h, title: meta.title || (base ? base.charAt(0).toUpperCase() + base.slice(1) : "Untitled"), caption: meta.caption, date: meta.date, taken: meta.taken, name: file.name };
  }

  /** Object urls for stored photographs, made once and kept for the session. */
  async function prepare(ids: string[]) {
    const d = await db();
    await Promise.all(ids.filter((a) => a.startsWith("asset:") && !urls.has(a)).map(async (a) => {
      const v = await d.get("assets", a.slice(6)); if (v) urls.set(a, URL.createObjectURL(new Blob([v.data], { type: v.type })));
    }));
  }
  const src = (a: string) => (a.startsWith("asset:") ? urls.get(a) ?? "" : a);
  async function bytes(a: string): Promise<Uint8Array> {
    if (!a.startsWith("asset:")) return new Uint8Array(await (await fetch(a)).arrayBuffer());
    const v = await (await db()).get("assets", a.slice(6)); if (!v) throw new Error(`Missing ${a}`); return new Uint8Array(v.data);
  }

  async function clear() { await (await db()).delete("sites", space); }
  return { load, save, onOther, putImage, prepare, src, bytes, clear, space };
}
export type Store = ReturnType<typeof createStore>;
