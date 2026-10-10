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
/** What the server knows of this space's site: its id there, the server revision last seen, the local revision last sent. */
export type Cloud = { id: string; revision: number; sent: number };
interface WallDB extends DBSchema {
  sites: { key: string; value: Rec };
  assets: { key: string; value: { type: string; data: ArrayBuffer } };
  /** pictures not yet on the server, by asset id */
  pending: { key: string; value: { at: number } };
  cloud: { key: string; value: Cloud };
}
/** Where bytes come from and go to when the artist is signed in; absent when working on this device alone. */
export type Remote = { get: (id: string) => Promise<{ type: string; data: ArrayBuffer } | null>; put: (id: string, type: string, data: ArrayBuffer) => Promise<unknown> };
export class StaleError extends Error { constructor() { super("This site was changed in another window."); this.name = "StaleError"; } }

const MAX_BYTES = 15 * 1024 * 1024, LONG_EDGE = 2400, MAX_FILM = 400 * 1024 * 1024;
let dbp: Promise<IDBPDatabase<WallDB>> | null = null;
const db = () => (dbp ??= openDB<WallDB>("latent-wall", 2, { upgrade(d) { for (const n of ["sites", "assets", "pending", "cloud"] as const) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); } }));

export function createStore(space = "artist", remote: Remote | null = null) {
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(`latent-wall:${space}`) : null;
  const urls = new Map<string, string>();
  let draining: Promise<void> | null = null, onSync: ((left: number) => void) | null = null;

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
    void queue(`asset:${id}`);
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    return { id: `asset:${id}`, w, h, title: meta.title || (base ? base.charAt(0).toUpperCase() + base.slice(1) : "Untitled"), caption: meta.caption, date: meta.date, taken: meta.taken, name: file.name };
  }

  /** Object urls for stored photographs, made once and kept for the session. */
  /** A film file, kept as it is (MP4 or QuickTime with H.264/HEVC plays everywhere the site does), measured by the browser. */
  async function putVideo(file: File): Promise<{ id: string; w: number; h: number; title: string; seconds: number; name: string }> {
    if (!/^video\/(mp4|quicktime|webm)$/.test(file.type) && !/\.(mp4|m4v|mov|webm)$/i.test(file.name)) throw new Error(`${file.name} is not a film file (MP4, MOV or WebM).`);
    if (file.size > MAX_FILM) throw new Error(`${file.name} is over 400 MB.`);
    const url = URL.createObjectURL(file), v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
    const m = await new Promise<{ w: number; h: number; seconds: number }>((ok, no) => { v.onloadedmetadata = () => ok({ w: v.videoWidth, h: v.videoHeight, seconds: v.duration }); v.onerror = () => no(new Error(`${file.name} could not be played by this browser.`)); v.src = url; });
    URL.revokeObjectURL(url);
    if (!m.w || !m.h) throw new Error(`${file.name} has no picture this browser can read.`);
    const id = crypto.randomUUID();
    try { await (await db()).put("assets", { type: file.type || "video/mp4", data: await file.arrayBuffer() }, id); }
    catch { throw new Error("This browser could not keep the film. In a private window, open the site in a normal one."); }
    void queue(`asset:${id}`);
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    return { id: `asset:${id}`, w: m.w, h: m.h, title: base ? base.charAt(0).toUpperCase() + base.slice(1) : "Film", seconds: m.seconds, name: file.name };
  }
  /** A stored picture's bytes: this device first, else the server's copy (kept here from then on). */
  async function stored(a: string): Promise<{ type: string; data: ArrayBuffer } | null> {
    const d = await db(), v = await d.get("assets", a.slice(6)); if (v) return v;
    if (!remote) return null;
    const r = await remote.get(a).catch(() => null); if (!r) return null;
    try { await d.put("assets", r, a.slice(6)); } catch { /* shown this session anyway */ }
    return r;
  }
  async function prepare(ids: string[]) {
    const want = ids.filter((a) => a.startsWith("asset:") && !urls.has(a)); let i = 0;
    await Promise.all(Array.from({ length: 6 }, async () => { while (i < want.length) { const a = want[i++], v = await stored(a); if (v) urls.set(a, URL.createObjectURL(new Blob([v.data], { type: v.type }))); } }));
  }
  const src = (a: string) => (a.startsWith("asset:") ? urls.get(a) ?? "" : a);
  async function bytes(a: string): Promise<Uint8Array> {
    if (!a.startsWith("asset:")) return new Uint8Array(await (await fetch(a)).arrayBuffer());
    const v = await stored(a); if (!v) throw new Error(`Missing ${a}`); return new Uint8Array(v.data);
  }

  /* ---- the server's copy of the pictures: a queue of what is not there yet, drained in the background */
  async function queue(a: string) { if (!remote) return; try { await (await db()).put("pending", { at: Date.now() }, a); } catch { return; } void drain(); }
  /** Every picture of the site goes into the queue (a first sign-in, or a site made before one); what is already up is skipped by the server's say. */
  async function queueAll(ids: string[]) { if (!remote) return; const d = await db(); for (const a of ids) if (a.startsWith("asset:")) await d.put("pending", { at: Date.now() }, a); void drain(); }
  function drain(): Promise<void> {
    if (!remote) return Promise.resolve();
    return (draining ??= (async () => {
      const d = await db(), keys = await d.getAllKeys("pending"); let left = keys.length; onSync?.(left);
      for (const a of keys) {
        const v = await d.get("assets", a.slice(6));
        if (v) { try { await remote.put(a, v.type, v.data); } catch { continue; } }
        await d.delete("pending", a); onSync?.(--left);
      }
      draining = null;
      // what failed stays queued for the next change, or the next visit
    })());
  }
  /** How many pictures still wait to reach the server; and a listener for the count as it falls. */
  async function waiting(): Promise<number> { return (await (await db()).getAllKeys("pending")).length; }
  function onSyncing(fn: (left: number) => void) { onSync = fn; }
  /* ---- what the server knows of this site */
  async function cloud(): Promise<Cloud | null> { return (await (await db()).get("cloud", space)) ?? null; }
  async function setCloud(c: Cloud | null) { const d = await db(); if (c) await d.put("cloud", c, space); else await d.delete("cloud", space); }

  async function clear() { const d = await db(); await d.delete("sites", space); await d.delete("cloud", space); }
  /** Every asset id any site in this browser refers to (its library holds the trash's works too). */
  async function everyLibrary(): Promise<Set<string>> {
    const out = new Set<string>();
    for (const rec of await (await db()).getAll("sites")) { const lib = (rec.value as { library?: Record<string, unknown> } | null)?.library; if (lib) for (const a of Object.keys(lib)) out.add(a); }
    return out;
  }
  /** Let go of stored photographs nothing refers to any more (a replaced picture, a deleted upload). Only on load, so Undo within a session stays whole. */
  async function sweep(referenced: Set<string>): Promise<number> {
    const d = await db(), keys = await d.getAllKeys("assets"), gone = keys.filter((k) => !referenced.has(`asset:${k}`));
    for (const k of gone) await d.delete("assets", k);
    return gone.length;
  }
  return { load, save, onOther, putImage, putVideo, prepare, src, bytes, clear, space, everyLibrary, sweep, queueAll, drain, waiting, onSyncing, cloud, setCloud, remote: !!remote };
}
export type Store = ReturnType<typeof createStore>;
