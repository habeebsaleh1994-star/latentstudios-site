/*
 * The Publish panel. Editing is always a draft; this is where the draft becomes the site:
 * what changed since the last publish, what to check first, then Publish. Every version is kept,
 * can be opened as a visitor would see it, downloaded as files, or put back as the draft.
 */
import { state, commit, notify } from "./main";
import { changes, checks, buildFiles, address } from "./publish";
import { createVersions, type Version } from "./versions";
import { zip } from "./zip";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
let sp = "mine", versions = createVersions("mine"), cache: Version[] = [], busy = false, lastUrl: string | null = null, built: { n: number; files: number; bytes: number } | null = null;

export function forSpace(space: string) { sp = space; versions = createVersions(space); cache = []; built = null; }
const pubUrl = (q: string) => `/app/index.html?published${sp === "mine" ? "" : `&space=${encodeURIComponent(sp)}`}${q}#/`;
export async function refresh() { cache = await versions.list(); return cache; }
export const published = () => cache[0] ?? null;
export const draftChanges = () => changes(published()?.site ?? null, state.site);

export function render(): string {
  const s = state.site, cur = published(), diff = draftChanges(), cs = checks(s), stop = cs.some((c) => c.stop);
  let h = `<h3>Address</h3><p class="addr">${esc(address(s.name))}</p><p class="hint">Where it will live. For now the site is made as files you keep; a real publish puts the same files at this address, and later at your own domain.</p>`;
  h += `<h3>${cur ? "Since you last published" : "What goes out"}</h3>`;
  h += diff.length ? `<ul class="diff">${diff.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : `<p class="hint">Nothing has changed since ${when(cur!.at)}.</p>`;
  if (cs.length) h += `<h3>Before you do</h3><ul class="diff warn">${cs.map((c) => `<li${c.stop ? ' class="stop"' : ""}>${esc(c.text)}</li>`).join("")}</ul>`;
  h += `<div class="pub-go">${busy ? `<span class="hint">Making the files…</span>` : `<button type="button" class="go" data-pub="publish"${stop || (!diff.length && cur) ? " disabled" : ""}>${cur ? "Publish again" : "Publish"}</button>`}${built && built.n === cur?.n ? `<p class="hint">Version ${built.n} published ${when(cur!.at)}: ${built.files} files, ${(built.bytes / 1048576).toFixed(1)} MB.</p>` : ""}</div>`;
  if (cur) h += `<div class="adds"><a class="link-ed" href="${pubUrl("")}" target="_blank" rel="noopener">Open the published site</a>${lastUrl ? `<a class="link-ed" href="${lastUrl}" download="${esc(address(s.name).split(".")[0])}-site.zip">Download the files</a>` : `<button type="button" class="link-ed" data-pub="download">Download the files</button>`}<a class="link-ed" href="${pubUrl(`&v=${cur.n}`)}" target="_blank" rel="noopener">Private preview link</a></div>`;
  if (cache.length) h += `<h3>Every version</h3><ol class="versions">${cache.map((v) => `<li><span><b>${v.n}</b> ${esc(when(v.at))}${v.n === cur!.n ? ' <em>· live</em>' : ""}</span><span class="acts"><a href="${pubUrl(`&v=${v.n}`)}" target="_blank" rel="noopener" aria-label="Open version ${v.n}">Open</a>${v.n === cur!.n && !diff.length ? "" : `<button type="button" data-pub="restore" data-n="${v.n}">Put back</button>`}</span></li>`).join("")}</ol><p class="hint">Put back makes that version the draft again; publish to make it live.</p>`;
  return h;
}

export async function act(what: string, n: number, redraw: () => void) {
  if (what === "publish") {
    busy = true; redraw();
    try {
      const v = await versions.publish(state.site); cache = await versions.list();
      const out = await build(v); built = { n: v.n, files: out.files, bytes: out.bytes };
      notify(`Published: version ${v.n}.`);
    } catch (e) { notify(`Could not publish: ${(e as Error).message}`); }
    busy = false; redraw(); return;
  }
  if (what === "download") { const cur = published(); if (!cur) return; busy = true; redraw(); try { await build(cur); } catch (e) { notify((e as Error).message); } busy = false; redraw(); return; }
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
    share: shareImage,
  });
  const blob = zip(files);
  if (lastUrl) URL.revokeObjectURL(lastUrl); lastUrl = URL.createObjectURL(blob);
  return { files: files.length, bytes: blob.size };
}
