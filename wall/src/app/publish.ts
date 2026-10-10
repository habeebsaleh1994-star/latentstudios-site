/*
 * Publishing. Editing is always a draft. Publish says what changed since the last time, checks the site,
 * then makes it as real files: a page per address, the assets, the photographs. Every published version
 * is kept, so the site can be put back as it was.
 */
import type { SiteDocument, SitePage } from "../studio/site";
import { page as renderPage, appearsOf, lockOf, wordFor, type Ctx } from "./render";
import { siteAssets } from "../studio/site";
import { seal, type Sealed } from "./lock";
import { house } from "./houses";
import { TYPEFACES } from "./theme";

/* ------------------------------------------------------------------ what changed */

const titleOf = (p: SitePage) => [p.title, p.titleEm].filter(Boolean).join(" ");
const sameJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const worksOn = (p: SitePage): string[] => p.kind === "story" ? p.pieces.flatMap((x) => (x.type === "work" ? [x.asset] : [])) : p.kind === "writing" ? (p.image ? [p.image.asset] : []) : p.kind === "film" ? [p.poster, p.video, ...p.stills.map((s) => s.asset)].filter((a): a is string => !!a) : p.kind === "project" ? [...p.outcome, ...p.process] : [];

/** Plain lines an artist can read: what the next publish will carry. Empty when nothing changed. */
export function changes(prev: SiteDocument | null, next: SiteDocument): string[] {
  if (!prev) return ["The whole site, published for the first time."];
  const out: string[] = [];
  if (prev.house !== next.house) out.push(`The template: now ${house(next.house).name}.`);
  else {
    const t = [] as string[], a = prev.theme, b = next.theme;
    if (a.look !== b.look) t.push("the look");
    if (a.typeface !== b.typeface) t.push("the type");
    if (a.accent !== b.accent || a.palette !== b.palette || a.mode !== b.mode) t.push("the colour");
    if (["header", "opening", "title", "captions", "footer", "scale"].some((k) => a[k as "header"] !== b[k as "header"])) t.push("the structure");
    if (a.mount !== b.mount || a.space !== b.space || a.read !== b.read || a.motion !== b.motion) t.push("the details");
    if (t.length) out.push(`Customise: ${t.join(", ")}.`);
  }
  if (prev.name !== next.name || prev.contact !== next.contact) out.push("Your name or the line at the foot.");
  if (!sameJSON(prev.front, next.front)) out.push(prev.front.form !== next.front.form ? `The front page, now ${{ covers: "covers", list: "a list", sheet: "a sheet", walk: "a walk", journal: "a journal", catalogue: "a catalogue", reading: "the reading", posters: "posters", ledger: "a ledger", archive: "an archive", threshold: "the threshold" }[next.front.form]}.` : "The front page's words.");
  const was = new Map(prev.pages.map((p) => [p.id, p]));
  const now = new Map(next.pages.map((p) => [p.id, p]));
  for (const p of next.pages) {
    const q = was.get(p.id);
    if (!q) { out.push(`New: ${titleOf(p)} (${p.kind === "story" ? `${worksOn(p).length} works` : p.kind}).`); continue; }
    if (sameJSON(p, q)) { const changedWorks = worksOn(p).filter((a) => !sameJSON(prev.library[a], next.library[a])); if (changedWorks.length) out.push(`${titleOf(p)}: ${changedWorks.length === 1 ? "a work's words" : `${changedWorks.length} works' words`}.`); continue; }
    const bits: string[] = [];
    if (titleOf(p) !== titleOf(q)) bits.push(`renamed from “${titleOf(q)}”`);
    if (p.kind === "story" && q.kind === "story") {
      const added = worksOn(p).filter((a) => !worksOn(q).includes(a)).length, removed = worksOn(q).filter((a) => !worksOn(p).includes(a)).length;
      if (added) bits.push(`${added} ${added === 1 ? "work" : "works"} added`); if (removed) bits.push(`${removed} removed`);
      if (p.arrangement !== q.arrangement) bits.push(`now ${p.arrangement}`);
      if (!added && !removed && p.arrangement === q.arrangement && !sameJSON(p.pieces, q.pieces)) bits.push("the order or how works sit");
    }
    if (p.inNav !== q.inNav) bits.push(p.inNav ? "shown again" : "hidden");
    if (p.word !== q.word) bits.push(p.word ? (q.word ? "its word" : "behind a word") : "no longer behind a word");
    if (!bits.length) bits.push("the words");
    out.push(`${titleOf(p)}: ${bits.join(", ")}.`);
  }
  for (const q of prev.pages) if (!now.has(q.id)) out.push(`Removed: ${titleOf(q)}.`);
  if (prev.door.soon !== next.door.soon) out.push(next.door.soon ? "Only a holding page is shown now." : "The site is shown, not just a holding page.");
  if (prev.door.word !== next.door.word) out.push(next.door.word ? (prev.door.word ? "The site's word." : "The site is behind a word now.") : "The site is no longer behind a word.");
  const order = (s: SiteDocument) => s.pages.map((p) => p.id).filter((id) => was.has(id) && now.has(id)).join("|");
  if (order(prev) !== order(next)) out.push("The order of the pages.");
  return out;
}

/** Things worth knowing before publishing. `stop` ones block it. */
export function checks(s: SiteDocument): { text: string; stop?: boolean }[] {
  const out: { text: string; stop?: boolean }[] = [];
  if (!s.name.trim() || s.name === "Your name") out.push({ text: "The site has no name yet.", stop: true });
  const work = s.pages.filter((p) => p.kind === "story" || p.kind === "writing" || p.kind === "film" || p.kind === "project");
  if (!work.length) out.push({ text: "There is no work on the site yet.", stop: true });
  for (const p of work) {
    if (p.kind === "story" && !worksOn(p).length) out.push({ text: `“${titleOf(p)}” has no works yet.` });
    if (p.kind === "writing" && !p.paras.some((t) => t.trim())) out.push({ text: `“${titleOf(p)}” has no text yet.` });
    if (p.kind === "film" && !p.poster && !p.video && !p.link) out.push({ text: `“${titleOf(p)}” has no film, poster or link yet.` });
  }
  for (const p of s.pages) if ((p.kind === "about" || p.kind === "contact") && !p.paras.some((t) => t.trim())) out.push({ text: `${p.title} is empty.` });
  for (const p of s.pages) if (p.kind === "record" && !p.paras.some((t) => t.trim()) && !p.sections.some((x) => x.entries.length)) out.push({ text: `${p.title} is empty.` });
  if (s.door.soon) out.push({ text: `Visitors will see only a holding page${s.door.word ? "; those with the word get in" : ""}.` });
  else if (s.door.word) out.push({ text: `The whole site is behind the word “${s.door.word}”.` });
  else for (const p of s.pages) if (p.word) out.push({ text: `“${titleOf(p)}” is behind the word “${p.word}”.` });
  return out;
}

/* ------------------------------------------------------------------ the files */

export type OutFile = { name: string; data: Uint8Array };
export type Sources = {
  /** the text of a file the app serves (a stylesheet, a script) */
  text: (url: string) => Promise<string>;
  /** the bytes of a photograph or film in the library */
  bytes: (asset: string) => Promise<Uint8Array>;
  /** a share image (1200 × 630) cut from a photograph around its focal point; absent where there is no canvas */
  share?: (asset: string, focal: { x: number; y: number }) => Promise<Uint8Array | null>;
  /** the site's icon (180 × 180 PNG) cut square from the artist's chosen picture around its focal point; absent where there is no canvas */
  icon?: (asset: string, focal: { x: number; y: number }) => Promise<Uint8Array | null>;
  /** the same photograph at smaller widths (JPEG), for screens that need no more; absent where there is no canvas */
  sizes?: (asset: string, widths: number[]) => Promise<{ w: number; data: Uint8Array }[]>;
};
/** Where "Latent Wall" at the foot of a published site leads. */
export const WALL_HOME = "https://latentstudios.com/wall";
/** The widths a picture is also made at. The full picture (up to 2400 px) is always there. */
export const SIZES = [640, 1200];
/** The srcset for a picture in the files: its smaller sizes and the full one, named beside it. */
export function srcsetFor(file: string, w: number, base: string, made: number[]): string | null {
  if (!made.length) return null;
  const stem = file.replace(/\.(jpg|jpeg|png|webp)$/i, ""), ext = file.slice(stem.length) || ".jpg";
  return [...made.map((s) => `${base}assets/img/${stem}-${s}${ext} ${s}w`), `${base}assets/img/${file} ${w}w`].join(", ");
}
/** A file name for an asset in the published site: its own name for a sample, its id for an upload. */
export const fileOf = (asset: string, kind: "image" | "video") => asset.startsWith("asset:") ? `${asset.slice(6)}.${kind === "video" ? "mp4" : "jpg"}` : asset.split("/").pop()!.replace(/[^A-Za-z0-9._-]/g, "-");

const ASSETS: [string, string][] = [["assets/fonts.css", "/design/shared/fonts.css"], ["assets/base.css", "/design/shared/base.css"], ["assets/looks.css", "/design/shared/looks.css"], ["assets/viewer.css", "/design/shared/viewer.css"], ["assets/app.css", "/src/app/app.css"], ["assets/app-looks.css", "/src/app/looks.css"], ["assets/theme.js", "/design/shared/theme.js"], ["assets/viewer.js", "/design/shared/viewer.js"], ["assets/visitor.js", "/app/visitor.js"]];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

type ThemeLib = { LOOKS: Record<string, { scheme?: string; vars?: Record<string, string>; night?: Record<string, string>; day?: Record<string, string> }>; PALETTES: Record<string, { light: Record<string, string>; dark: Record<string, string> }>; accentFor: (look: string, chosen: string | null, dark: boolean, palette: string, vars?: Record<string, string>) => { peony: string; text: string; on: string } };
/** The colour variables a page carries for one scheme: the look's own (or its other half), the palette for the quiet look, and the artist's accent fitted to that ground. */
function colours(L: ThemeLib | undefined, t: SiteDocument["theme"], dark: boolean): Record<string, string> {
  if (!L) return {};
  const look = t.look !== "quiet" ? L.LOOKS[t.look] : null, out: Record<string, string> = {};
  let vars: Record<string, string> | undefined;
  if (look?.vars) {
    const half = dark ? (look.scheme === "dark" ? {} : look.night) : (look.scheme === "light" ? {} : look.day);
    vars = { ...look.vars, ...(half ?? {}) }; Object.assign(out, vars);
    if (!half && dark !== (look.scheme === "dark")) dark = look.scheme === "dark"; // a look with no other half keeps its own scheme
  } else {
    const p = L.PALETTES[t.palette] ?? L.PALETTES.silk, c = dark ? p.dark : p.light;
    Object.assign(out, { "--silk": c.silk, "--silk-deep": c.deep, "--ink": c.ink, "--ink-soft": c.soft, "--rule": c.rule });
  }
  const A = L.accentFor(look ? t.look : "quiet", t.accent, dark, t.palette, vars);
  out["--peony"] = A.peony; out["--peony-text"] = A.text; out["--on-accent"] = A.on;
  return out;
}
/** Whether a page stands behind the door for a visitor who has given nothing. */
const hidden = (site: SiteDocument, p: SitePage | null) => site.door.soon || !!wordFor(site, p);
/**
 * The site as a visitor's browser may hold it: no words; the content of pages behind the door stripped,
 * with the works only they use; the trash gone. `keep` is the page whose content may stay (the one being
 * shown, once opened), or "all" inside something sealed with the site's own word.
 */
export function publicSite(site: SiteDocument, keep: string | "all" | null): SiteDocument {
  const s = structuredClone(site);
  const strip = (p: SitePage) => {
    if (p.kind === "story") { p.pieces = []; p.note = ""; p.kicker = ""; }
    else if (p.kind === "writing") { p.paras = []; p.image = null; p.margin = ""; }
    else if (p.kind === "film") { p.poster = null; p.video = null; p.stills = []; p.synopsis = ""; p.credits = []; p.link = ""; }
    else if (p.kind === "project") { p.outcome = []; p.process = []; p.summary = ""; p.facts = []; }
    else p.paras = [];
    p.appears = { title: "", description: "", share: null };
  };
  for (const p of s.pages) { if (keep !== "all" && hidden(site, p) && p.id !== keep) strip(p); p.word = ""; }
  s.door.word = ""; s.trash = [];
  if (keep !== "all" && hidden(site, null)) s.appears.share = null;
  const used = new Set([...s.pages.flatMap(worksOn), ...siteAssets(s)]);
  for (const a of Object.keys(s.library)) if (!used.has(a)) delete s.library[a];
  return s;
}
type FileOpts = {
  /** file names for the works of pages behind the door (unguessable, so the files are found only through the opened page) */
  names?: Map<string, string>;
  /** which smaller widths were made for each picture */
  made?: Map<string, number[]>;
  /** the artist's own icon is among the files */
  icon?: boolean;
  /** the version of the shared assets (a hash of their text), named in every link to them so a browser never keeps an old one */
  ver?: string;
  /** the door this file shows instead of the page */
  lock?: "soon" | "word";
  /** the page itself, sealed with its word, carried inside the door */
  sealed?: Sealed;
  /** inside a sealed page: whose content the carried document keeps */
  keep?: string | "all" | null;
};
/** One page as a complete html file. `base` is the path back to the site's root from this page ("" or "../"). */
export function pageFile(site: SiteDocument, p: SitePage | null, base: string, o: FileOpts = {}): string {
  const fileName = (a: string) => o.names?.get(a) ?? fileOf(a, site.library[a]?.kind ?? "image");
  const ctx: Ctx = { site, editing: false, href: (id) => (id ? `${base}${encodeURIComponent(id)}/` : base || "./"), src: (a) => `${base}assets/img/${fileName(a)}`, locked: o.lock ? () => o.lock! : undefined, home: WALL_HOME, srcset: (a) => (o.made?.get(a)?.length && site.library[a] ? srcsetFor(fileName(a), site.library[a].w, base, o.made.get(a)!) : null) };
  const carried = publicSite(site, o.lock ? null : (o.keep ?? null));
  const t = site.theme, look = t.look, L = (globalThis as unknown as { FolioTheme?: ThemeLib }).FolioTheme;
  const face = t.typeface ? TYPEFACES[t.typeface] : null;
  const faceVars = face ? [`--serif:${face.display}`, `--body:${face.body}`, `--sans:${face.label}`, `--title-weight:${face.weight}`] : [];
  // the colours for the first paint: by day, by night, or both (the device's choice) when the mode is "system"
  const day = colours(L, t, false), night = colours(L, t, true), first = t.mode === "dark" ? night : day;
  const style = Object.entries(first).map(([k, v]) => `${k}:${v}`).concat(faceVars).join(";");
  const nightBlock = t.mode === "system" ? `<style>@media (prefers-color-scheme: dark) { :root { ${Object.entries(night).map(([k, v]) => `${k}:${v}`).join(";")} } }</style>` : "";
  const scheme = t.mode === "system" ? "" : ` data-scheme="${t.mode === "dark" ? "dark" : "light"}"`;
  const data = `data-look="${look}"${scheme} data-header="${t.header}" data-opening="${t.opening}" data-title="${t.title}" data-captions="${t.captions}" data-footer="${t.footer}" data-scale="${t.scale}" data-mount="${t.mount}" data-motion="${t.motion}" data-read="${t.read}"${t.typeface ? ` data-typeface="${t.typeface}"` : ""} data-preview="on"`;
  const ap = appearsOf(ctx, p), shareFile = ap.share ? shareFileFor(site, p) : null;
  return `<!doctype html>
<html lang="en" data-house="${site.house}" ${data}${style ? ` style="${esc(style)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(ap.title)}</title>
<meta name="description" content="${esc(ap.description)}">
<meta property="og:title" content="${esc(ap.title)}">
<meta property="og:description" content="${esc(ap.description)}">
<meta property="og:type" content="website">${shareFile ? `
<meta property="og:image" content="${base}${shareFile}">
<meta name="twitter:card" content="summary_large_image">` : ""}
${o.icon ? `<link rel="icon" href="${base}assets/icon.png${o.ver ? `?v=${o.ver}` : ""}" type="image/png">
<link rel="apple-touch-icon" href="${base}assets/icon.png${o.ver ? `?v=${o.ver}` : ""}">` : `<link rel="icon" href="${base}assets/favicon.svg${o.ver ? `?v=${o.ver}` : ""}" type="image/svg+xml">`}
<link rel="stylesheet" href="${base}assets/fonts.css${o.ver ? `?v=${o.ver}` : ""}">
<link rel="stylesheet" href="${base}assets/base.css${o.ver ? `?v=${o.ver}` : ""}">
<link rel="stylesheet" href="${base}assets/looks.css${o.ver ? `?v=${o.ver}` : ""}">
<link rel="stylesheet" href="${base}assets/viewer.css${o.ver ? `?v=${o.ver}` : ""}">
<link rel="stylesheet" href="${base}assets/app.css${o.ver ? `?v=${o.ver}` : ""}">
<link rel="stylesheet" href="${base}assets/app-looks.css${o.ver ? `?v=${o.ver}` : ""}">
${nightBlock}${t.mode === "system" ? `<script>document.documentElement.dataset.scheme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"</script>` : ""}
</head>
<body><div id="app">${renderPage(ctx, p)}</div>
<script>window.STATIC=${JSON.stringify({ page: p ? p.id : null, base, site: carried, sealed: o.sealed, names: o.lock ? undefined : Object.fromEntries([...(o.names ?? [])].filter(([a]) => a in carried.library)), made: o.lock ? undefined : Object.fromEntries([...(o.made ?? [])].filter(([a]) => a in carried.library)) }).replace(/</g, "\\u003c")}</script>
<script src="${base}assets/theme.js${o.ver ? `?v=${o.ver}` : ""}"></script>
<script src="${base}assets/viewer.js${o.ver ? `?v=${o.ver}` : ""}"></script>
<script src="${base}assets/visitor.js${o.ver ? `?v=${o.ver}` : ""}"></script>
<!-- Made with Latent Wall -->
</body>
</html>
`;
}

/** Every file of the published site. */
export async function buildFiles(site: SiteDocument, src: Sources): Promise<OutFile[]> {
  const enc = new TextEncoder(), files: OutFile[] = [];
  // works seen only behind the door get unguessable file names; they ship only when a word can open them
  const open = publicSite(site, null), openUsed = new Set([...open.pages.flatMap(worksOn), ...siteAssets(site)]), names = new Map<string, string>();
  const canOpen = !site.door.soon || !!site.door.word;
  for (const p of site.pages) if (hidden(site, p) && canOpen) for (const a of worksOn(p)) if (!openUsed.has(a) && !names.has(a)) names.set(a, `${[...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("")}.${site.library[a]?.kind === "video" ? "mp4" : "jpg"}`);
  // the pictures at smaller widths too, when the runtime can make them
  const made = new Map<string, number[]>(), shipped = [...openUsed, ...names.keys()].filter((a) => site.library[a]?.kind === "image");
  if (src.sizes) await Promise.all(shipped.map(async (a) => { const w = site.library[a]; const widths = SIZES.filter((s) => s < w.w); if (!widths.length) return; try { const out = await src.sizes!(a, widths); const file = names.get(a) ?? fileOf(a, "image"), stem = file.replace(/\.(jpg|jpeg|png|webp)$/i, ""), ext = file.slice(stem.length) || ".jpg"; for (const v of out) files.push({ name: `assets/img/${stem}-${v.w}${ext}`, data: v.data }); made.set(a, out.map((v) => v.w)); } catch { /* the full picture alone */ } }));
  // the artist's own icon, when they chose one and the runtime can cut it
  let icon = false;
  if (site.mark.icon && site.library[site.mark.icon] && src.icon) { try { const d = await src.icon(site.mark.icon, site.library[site.mark.icon].focal); if (d) { files.push({ name: "assets/icon.png", data: d }); icon = true; } } catch { /* the initial, then */ } }
  await Promise.all(ASSETS.map(async ([name, url]) => files.push({ name, data: enc.encode(await src.text(url)) })));
  // the assets' version: a short hash of everything a page links to, so a change to a stylesheet or a script reaches every browser
  let h = 2166136261; for (const f of files.filter((x) => x.name.startsWith("assets/") && !x.name.startsWith("assets/img/") && !x.name.startsWith("assets/fonts/"))) for (const b of f.data) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
  const ver = h.toString(16).padStart(8, "0");
  const fileFor = async (p: SitePage | null, base: string) => {
    if (!hidden(site, p)) return pageFile(site, p, base, { names, made, icon, ver });
    const word = site.door.soon ? site.door.word : wordFor(site, p);
    const sealed = word ? await seal(pageFile(site, p, base, { names, made, icon, ver, keep: site.door.word ? "all" : p!.id }), word) : undefined;
    return pageFile(site, p, base, { names, icon, ver, lock: site.door.soon ? "soon" : "word", sealed });
  };
  files.push({ name: "index.html", data: enc.encode(await fileFor(null, "")) });
  for (const p of site.pages) files.push({ name: `${p.id}/index.html`, data: enc.encode(await fileFor(p, "../")) });

  // the faces themselves, so the site depends on no one at load
  const faces = [...(await src.text("/design/shared/fonts.css")).matchAll(/url\(fonts\/([^)]+)\)/g)].map((m) => m[1]);
  await Promise.all(faces.map(async (f) => { try { files.push({ name: `assets/fonts/${f}`, data: await src.bytes(`/design/shared/fonts/${f}`) }); } catch { /* a face that is not there is left out */ } }));
  await Promise.all([...openUsed, ...names.keys()].map(async (a) => { const w = site.library[a]; if (w) files.push({ name: `assets/img/${names.get(a) ?? fileOf(a, w.kind)}`, data: await src.bytes(a) }); }));
  files.push({ name: "assets/favicon.svg", data: enc.encode(favicon(site)) });
  if (src.share) {
    // one share image per distinct picture and focal point; pages that share a source share the file
    const done = new Set<string>();
    await Promise.all([null, ...site.pages].map(async (p) => { const name = shareFileFor(site, p); if (!name || done.has(name)) return; done.add(name); const ap = appearsOf(bare(site), p); const data = await src.share!(ap.share!.asset, ap.share!.focal); if (data) files.push({ name, data }); }));
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
const bare = (site: SiteDocument): Ctx => ({ site, editing: false, href: () => "", src: (a) => a, locked: (p) => lockOf(site, p, []) });
/** The share image file a page points at: named after the first page (the front first) that shows the same picture at the same focal point. */
export function shareFileFor(site: SiteDocument, p: SitePage | null): string | null {
  const c = bare(site), ap = appearsOf(c, p); if (!ap.share) return null;
  const key = (q: SitePage | null) => { const a = appearsOf(c, q); return a.share ? `${a.share.asset}|${a.share.focal.x},${a.share.focal.y}` : ""; };
  const all = [null, ...site.pages], mine = key(p), i = all.findIndex((q) => key(q) === mine), first = i < 0 ? p : all[i];
  return `assets/share/${first ? first.id : "front"}.jpg`;
}
/** The site's icon: the artist's logo when they have one, else their initial on the site's ground, in its display face. */
export function favicon(site: SiteDocument): string {
  const L = (globalThis as unknown as { FolioTheme?: { LOOKS: Record<string, { vars?: Record<string, string> }> } }).FolioTheme;
  const vars = site.theme.look !== "quiet" && L?.LOOKS[site.theme.look]?.vars ? L.LOOKS[site.theme.look].vars! : {};
  const ground = vars["--silk"] ?? "#EEE9E7", ink = vars["--ink"] ?? "#29222A", face = (site.theme.typeface ? TYPEFACES[site.theme.typeface].display : vars["--serif"] ?? "Newsreader, Georgia, serif").replace(/"/g, "'");
  const initial = (site.name.trim().match(/\p{L}/u)?.[0] ?? "l").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${ground}"/><text x="32" y="45" text-anchor="middle" font-family="${esc(face)}" font-size="40" font-weight="300" fill="${ink}">${esc(initial)}</text></svg>`;
}
/** The domain under which a published site lives; one place to change when the real one is decided. */
export const SITE_DOMAIN = "latent.site";
export const address = (name: string) => `${name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site"}.${SITE_DOMAIN}`;
