/*
 * The Publish panel. Editing is always a draft; this is where the draft becomes the site:
 * what changed since the last publish, what to check first, then Publish. Every version is kept,
 * can be opened as a visitor would see it, downloaded as files, or put back as the draft.
 */
import { state, commit, notify, pushNow } from "./main";
import { changes, checks, buildFiles, address, label } from "./publish";
import * as account from "./account";
import { createVersions, type Version } from "./versions";
import { zip } from "./zip";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
let sp = "mine", versions = createVersions("mine"), cache: Version[] = [], busy: string | false = false, lastUrl: string | null = null, built: { n: number; files: number; bytes: number } | null = null, live: string | null = null, failed: string | null = null;

export function forSpace(space: string) { sp = space; versions = createVersions(space); cache = []; built = null; }
const pubUrl = (q: string) => `/app/index.html?published${sp === "mine" ? "" : `&space=${encodeURIComponent(sp)}`}${q}#/`;
export async function refresh() { cache = await versions.list(); return cache; }
export const published = () => cache[0] ?? null;
export const draftChanges = () => changes(published()?.site ?? null, state.site);

export function render(): string {
  const s = state.site, cur = published(), diff = draftChanges(), cs = checks(s), stop = cs.some((c) => c.stop), me = account.signedIn(), online = !!(me && state.cloud);
  const addr = online ? `https://${address(s.name)}/` : address(s.name);
  let h = `<h3>Address</h3><p class="addr">${esc(addr)}</p><p class="hint">${online ? "Where the site lives once you publish. It follows your name; a domain of your own comes later." : "Where it will live. Working on this device alone, the site is made as files you keep; signed in, Publish puts them at this address."}</p>`;
  h += `<h3>${cur ? "Since you last published" : "What goes out"}</h3>`;
  h += diff.length ? `<ul class="diff">${diff.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : `<p class="hint">Nothing has changed since ${when(cur!.at)}.</p>`;
  if (cs.length) h += `<h3>Before you do</h3><ul class="diff warn">${cs.map((c) => `<li${c.stop ? ' class="stop"' : ""}>${esc(c.text)}</li>`).join("")}</ul>`;
  h += `<div class="pub-go">${busy ? `<span class="hint">${esc(busy)}</span>` : `<button type="button" class="go" data-pub="publish"${stop || (!diff.length && cur) ? " disabled" : ""}>${cur ? "Publish again" : "Publish"}</button>`}${failed ? `<p class="hint stop">${esc(failed)}</p>` : ""}${built && built.n === cur?.n ? `<p class="hint">Version ${built.n} published ${when(cur!.at)}: ${built.files} files, ${(built.bytes / 1048576).toFixed(1)} MB.${live ? ` Live at <a href="${esc(live)}" target="_blank" rel="noopener">${esc(live.replace(/^https:\/\/|\/$/g, ""))}</a>.` : ""}</p>` : ""}</div>`;
  if (cur) h += `<div class="adds"><a class="link-ed" href="${online ? esc(addr) : pubUrl("")}" target="_blank" rel="noopener">Open the published site</a>${lastUrl ? `<a class="link-ed" href="${lastUrl}" download="${esc(label(s.name))}-site.zip">Download the files</a>` : `<button type="button" class="link-ed" data-pub="download">Download the files</button>`}<a class="link-ed" href="${pubUrl(`&v=${cur.n}`)}" target="_blank" rel="noopener">Private preview link</a></div>`;
  if (cache.length) h += `<h3>Every version</h3><ol class="versions">${cache.map((v) => `<li><span><b>${v.n}</b> ${esc(when(v.at))}${v.n === cur!.n ? ' <em>· live</em>' : ""}</span><span class="acts"><a href="${pubUrl(`&v=${v.n}`)}" target="_blank" rel="noopener" aria-label="Open version ${v.n}">Open</a>${v.n === cur!.n && !diff.length ? "" : `<button type="button" data-pub="restore" data-n="${v.n}">Put back</button>`}</span></li>`).join("")}</ol><p class="hint">Put back makes that version the draft again; publish to make it live.</p>`;
  return h;
}

export async function act(what: string, n: number, redraw: () => void) {
  if (what === "publish") {
    busy = "Making the files…"; failed = null; redraw();
    try {
      const v = await versions.publish(state.site); cache = await versions.list();
      const out = await build(v); built = { n: v.n, files: out.files, bytes: out.bytes };
      if (state.cloud) {
        // the draft on the server first, then the files where the world sees them
        await pushNow();
        busy = `Sending ${out.files} files…`; redraw();
        const r = await account.publish(state.cloud.id, label(state.site.name), out.list, (d, of) => { busy = `Sending the files… ${d} of ${of}`; redraw(); });
        live = r.address; notify(`Live: version ${v.n} is at ${r.address.replace(/^https:\/\/|\/$/g, "")}.${r.fresh ? " The address is new: give it a few minutes to open everywhere." : ""}`);
      } else notify(`Published: version ${v.n}.`);
    } catch (e) { failed = `Not published: ${(e as Error).message}`; notify(failed); }
    busy = false; redraw(); return;
  }
  if (what === "download") { const cur = published(); if (!cur) return; busy = "Making the files…"; redraw(); try { await build(cur); } catch (e) { notify((e as Error).message); } busy = false; redraw(); return; }
  if (what === "restore") {
    const v = await versions.get(n); if (!v) return;
    await state.store.prepare(Object.keys(v.site.library));
    commit(v.site, { keep: false }); notify(`Version ${n} is the draft now. Publish to make it live.`); redraw();
  }
}

/** A share image: the photograph cut to 1200 × 630 around its focal point, as a JPEG. */
async function shareImage(asset: string, focal: { x: number; y: number }): Promise<Uint8Array | null> {
  try {
    const img = new Image(); img.src = state.store.src(asset); await img.decode();
    const W = 1200, H = 630, r = img.naturalWidth / img.naturalHeight, scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = W / scale, sh = H / scale, sx = Math.max(0, Math.min(img.naturalWidth - sw, (focal.x / 100) * img.naturalWidth - sw / 2)), sy = Math.max(0, Math.min(img.naturalHeight - sh, (focal.y / 100) * img.naturalHeight - sh / 2));
    void r;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/jpeg", 0.86)); return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch { return null; }
}

/** The icon: the picture cut square around its focal point, 180 px, as a PNG. */
async function iconImage(asset: string, focal: { x: number; y: number }): Promise<Uint8Array | null> {
  try {
    const img = new Image(); img.src = state.store.src(asset); await img.decode();
    const S = 180, side = Math.min(img.naturalWidth, img.naturalHeight), sx = Math.max(0, Math.min(img.naturalWidth - side, (focal.x / 100) * img.naturalWidth - side / 2)), sy = Math.max(0, Math.min(img.naturalHeight - side, (focal.y / 100) * img.naturalHeight - side / 2));
    const cv = document.createElement("canvas"); cv.width = S; cv.height = S; cv.getContext("2d")!.drawImage(img, sx, sy, side, side, 0, 0, S, S);
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/png")); return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch { return null; }
}

async function build(v: Version) {
  const sizesOf = async (asset: string, widths: number[]) => {
    const bytes = await state.store.bytes(asset), bmp = await createImageBitmap(new Blob([bytes as BlobPart]));
    const out: { w: number; data: Uint8Array }[] = [];
    for (const w of widths) { const h = Math.round((bmp.height * w) / bmp.width), cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d")!.drawImage(bmp, 0, 0, w, h); const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/jpeg", 0.84)); if (blob) out.push({ w, data: new Uint8Array(await blob.arrayBuffer()) }); }
    bmp.close(); return out;
  };
  const files = await buildFiles(v.site, {
    sizes: sizesOf,
    text: async (u) => { const r = await fetch(u + (u.endsWith(".css") || u.endsWith(".ts") ? "?raw" : "")); const t = await r.text(); const m = /^export default ("(?:[^"\\]|\\.)*")/.exec(t); return m ? JSON.parse(m[1]) : t; },
    bytes: (a) => state.store.bytes(a),
    share: shareImage, icon: iconImage,
  });
  const blob = zip(files);
  if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(blob);
  return { files: files.length, bytes: blob.size, list: files };
}
