/*
 * Publishing. Editing is always a draft. Publish says what changed since the last time, checks the site,
 * then makes it as real files: a page per address, the assets, the photographs. Every published version
 * is kept, so the site can be put back as it was.
 */
import type { SiteDocument, SitePage } from "../studio/site";
import { page as renderPage, appearsOf, type Ctx } from "./render";
import { siteAssets } from "../studio/site";
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
  if (!sameJSON(prev.front, next.front)) out.push(prev.front.form !== next.front.form ? `The front page, now ${{ covers: "covers", list: "a list", sheet: "a sheet", walk: "a walk" }[next.front.form]}.` : "The front page's words.");
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
    if (!bits.length) bits.push("the words");
    out.push(`${titleOf(p)}: ${bits.join(", ")}.`);
  }
  for (const q of prev.pages) if (!now.has(q.id)) out.push(`Removed: ${titleOf(q)}.`);
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
};
/** A file name for an asset in the published site: its own name for a sample, its id for an upload. */
export const fileOf = (asset: string, kind: "image" | "video") => asset.startsWith("asset:") ? `${asset.slice(6)}.${kind === "video" ? "mp4" : "jpg"}` : asset.split("/").pop()!.replace(/[^A-Za-z0-9._-]/g, "-");

const ASSETS: [string, string][] = [["assets/base.css", "/design/shared/base.css"], ["assets/looks.css", "/design/shared/looks.css"], ["assets/viewer.css", "/design/shared/viewer.css"], ["assets/app.css", "/src/app/app.css"], ["assets/app-looks.css", "/src/app/looks.css"], ["assets/theme.js", "/design/shared/theme.js"], ["assets/viewer.js", "/design/shared/viewer.js"], ["assets/visitor.js", "/app/visitor.js"]];
const FONTS = "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300;1,6..72,400&family=Instrument+Sans:wght@400;500&family=Instrument+Serif:ital@0;1&family=Libre+Caslon+Text:ital,wght@0,400;1,400&family=Karla:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Archivo:wght@400;500;600;700&family=Jost:wght@300;400;500&family=Fraunces:ital,wght@0,400;0,800;1,400;1,800&family=Courier+Prime:wght@400;700&family=Young+Serif&family=DM+Sans:wght@400;500&family=Bodoni+Moda:ital,wght@0,400;1,400&display=swap";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** One page as a complete html file. `base` is the path back to the site's root from this page ("" or "../"). */
export function pageFile(site: SiteDocument, p: SitePage | null, base: string): string {
  const ctx: Ctx = { site, editing: false, href: (id) => (id ? `${base}${encodeURIComponent(id)}/` : base || "./"), src: (a) => `${base}assets/img/${fileOf(a, site.library[a]?.kind ?? "image")}` };
  const t = site.theme, look = t.look, L = (globalThis as unknown as { FolioTheme?: { LOOKS: Record<string, { vars?: Record<string, string> }> } }).FolioTheme;
  const vars = look !== "quiet" && L?.LOOKS[look]?.vars ? L.LOOKS[look].vars! : {};
  const face = t.typeface ? TYPEFACES[t.typeface] : null;
  const style = Object.entries(vars).map(([k, v]) => `${k}:${v}`).concat(face ? [`--serif:${face.display}`, `--body:${face.body}`, `--sans:${face.label}`, `--title-weight:${face.weight}`] : []).join(";");
  const data = `data-look="${look}" data-header="${t.header}" data-opening="${t.opening}" data-title="${t.title}" data-captions="${t.captions}" data-footer="${t.footer}" data-scale="${t.scale}" data-mount="${t.mount}" data-motion="${t.motion}" data-read="${t.read}"${t.typeface ? ` data-typeface="${t.typeface}"` : ""} data-preview="on"`;
  const ap = appearsOf(ctx, p), shareFile = ap.share ? shareFileFor(site, p) : null;
  return `<!doctype html>
<html lang="en" ${data}${style ? ` style="${esc(style)}"` : ""}>
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
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${base}assets/base.css">
<link rel="stylesheet" href="${base}assets/looks.css">
<link rel="stylesheet" href="${base}assets/viewer.css">
<link rel="stylesheet" href="${base}assets/app.css">
<link rel="stylesheet" href="${base}assets/app-looks.css">
</head>
<body><div id="app">${renderPage(ctx, p)}</div>
<script>window.STATIC=${JSON.stringify({ page: p ? p.id : null, base, site }).replace(/</g, "\\u003c")}</script>
<script src="${base}assets/theme.js"></script>
<script src="${base}assets/viewer.js"></script>
<script src="${base}assets/visitor.js"></script>
<!-- Made with Latent Wall -->
</body>
</html>
`;
}

/** Every file of the published site. */
export async function buildFiles(site: SiteDocument, src: Sources): Promise<OutFile[]> {
  const enc = new TextEncoder(), files: OutFile[] = [];
  files.push({ name: "index.html", data: enc.encode(pageFile(site, null, "")) });
  for (const p of site.pages) files.push({ name: `${p.id}/index.html`, data: enc.encode(pageFile(site, p, "../")) });
  await Promise.all(ASSETS.map(async ([name, url]) => files.push({ name, data: enc.encode(await src.text(url)) })));
  const used = new Set([...site.pages.flatMap(worksOn), ...siteAssets(site)]);
  await Promise.all([...used].map(async (a) => { const w = site.library[a]; if (w) files.push({ name: `assets/img/${fileOf(a, w.kind)}`, data: await src.bytes(a) }); }));
  files.push({ name: "assets/favicon.svg", data: enc.encode(favicon(site)) });
  if (src.share) {
    // one share image per distinct picture and focal point; pages that share a source share the file
    const done = new Set<string>();
    await Promise.all([null, ...site.pages].map(async (p) => { const name = shareFileFor(site, p); if (!name || done.has(name)) return; done.add(name); const ap = appearsOf(bare(site), p); const data = await src.share!(ap.share!.asset, ap.share!.focal); if (data) files.push({ name, data }); }));
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
const bare = (site: SiteDocument): Ctx => ({ site, editing: false, href: () => "", src: (a) => a });
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
export const address = (name: string) => `${name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site"}.latent.site`;
