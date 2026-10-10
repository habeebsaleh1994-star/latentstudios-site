/*
 * The whole site, drawn from the site document. Every page kind and every arrangement lives here,
 * so a site can mix them: a story held still, another as a book, a film, a poem, a project.
 *
 * Rendering returns html strings. In edit mode the same functions mark words as editable
 * (data-ed names the field) and add the editor's quiet marks; the page itself never changes shape.
 */
import { fold } from "./lock";
import type { SiteDocument, SitePage, StoryPage, Work, Piece } from "../studio/site";
import { ratioNumber } from "./util";
import { house } from "./houses";

/** The mark of the family, as the studio writes its own: spaced capitals and a rose full stop. Typographic, so it takes every look's ink and sans. */
export const MARK = `<span class="lw">Latent Wall<i>.</i></span>`;

export type Ctx = {
  site: SiteDocument;
  editing: boolean;
  /** Address of a page ("" is the front) as a link the current runtime understands. */
  href: (pageId: string) => string;
  /** Where an asset's file is, for the current runtime (dev server, stored upload, published files). */
  src: (asset: string) => string;
  /** What stands between a visitor and this page right now: the holding page, the word, or nothing. Absent while editing. */
  locked?: (p: SitePage | null) => "soon" | "word" | null;
  /** Try a word at the door; true opens the page. */
  open?: (word: string, p: SitePage | null) => Promise<boolean>;
  /** The same picture at several widths, when the runtime has them (the published files): the browser picks by its screen. */
  srcset?: (asset: string) => string | null;
  /** Where "Latent Wall" at the foot leads: the arrival page in the app, the product's address in the files. */
  home?: string;
};
/** The word a page is behind: the site's, or its own. */
export const wordFor = (site: SiteDocument, p: SitePage | null) => site.door.word || p?.word || "";
/** What stands between a visitor and a page, given the words they have already given. */
export function lockOf(site: SiteDocument, p: SitePage | null, given: string[]): "soon" | "word" | null {
  const has = (w: string) => given.some((g) => fold(g) === fold(w));
  if (site.door.soon && !(site.door.word && has(site.door.word))) return "soon";
  const w = wordFor(site, p);
  return w && !has(w) ? "word" : null;
}
export type W = Work & { asset: string; src: string; r: number; n: string; k: number };

const ENT: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ENT[c]);

/** A word the artist can type into, in edit mode; plain text otherwise. `field` says where it goes. */
function ed(c: Ctx, field: string, value: string, tag = "span", cls = "", ph = "") {
  const k = cls ? ` class="${cls}"` : "";
  if (!c.editing) return value ? `<${tag}${k}>${esc(value)}</${tag}>` : tag === "span" ? "" : `<${tag}${k}></${tag}>`;
  return `<${tag}${k} contenteditable="plaintext-only" spellcheck="false" data-ed="${esc(field)}" data-ph="${esc(ph)}">${esc(value)}</${tag}>`;
}
const titleOf = (c: Ctx, base: string, t: string, em: string) => ed(c, `${base}.title`, t, "span", "", "Title") + (em || c.editing ? ` <em>${ed(c, `${base}.titleEm`, em, "span", "", "an italic part")}</em>` : "");
const plainTitle = (t: string, em: string) => esc(t) + (em ? ` <em>${esc(em)}</em>` : "");
const n2 = (n: number) => String(n).padStart(2, "0");

export function work(c: Ctx, asset: string, k = 0, n = 0): W {
  const w = c.site.library[asset];
  return { ...w, asset, src: c.src(asset), r: w.w / w.h, n: n2(n), k };
}
function img(c: Ctx, w: W, lazy = true, extra = "") {
  const set = c.srcset?.(w.asset);
  return `<img src="${esc(w.src)}"${set ? ` srcset="${esc(set)}" sizes="(max-width: 700px) 100vw, (max-width: 1100px) 92vw, 1440px"` : ""} width="${w.w}" height="${w.h}" alt="${esc(w.alt || w.title)}"${lazy ? ' loading="lazy"' : ""}${extra} style="--r:${w.r.toFixed(4)}">`;
}
/** The back of the print. Turned over, a work shows where it was made, a line in the artist's hand, its edition and how it was made. Offered when there is something written there, and always while editing. */
export const hasVerso = (w: W) => !!(w.verso.place || w.verso.line || w.verso.edition || w.verso.made);
function verso(c: Ctx, w: W) {
  if (!hasVerso(w) && !c.editing) return "";
  const f = (k: keyof W["verso"], tag: string, cls: string, ph: string) => (w.verso[k] || c.editing ? ed(c, `work:${w.asset}.verso.${k}`, w.verso[k], tag, cls, ph) : "");
  return `<div class="verso" data-verso="${esc(w.asset)}" aria-label="The back of ${esc(w.title || "the work")}"><div class="verso-in"><span class="label">${esc(w.title)}${w.date ? ` · ${esc(w.date)}` : ""}</span>${f("place", "p", "place", "Where it was made")}${f("line", "p", "line", "A line, in your hand")}${f("edition", "p", "edition", "Edition: 1 of 10")}${f("made", "p", "made", "How it was made: the film, the paper, the print")}</div></div><button type="button" class="flip" data-turn aria-label="Turn it over"><span></span></button>`;
}
function cap(c: Ctx, w: W, date = true) {
  // in Salon every work carries its real dimensions
  const size = c.site.house === "salon" ? (() => { const s = cmOf(w); return `<span class="d sz">${cmText(s.w)} × ${cmText(s.h)} cm</span>`; })() : "";
  return `<p class="cap"><span class="n">${w.n}</span>${ed(c, `work:${w.asset}.title`, w.title, "span", "t", "Title")}${size}${date && !size ? `<span class="d">${ed(c, `work:${w.asset}.date`, w.date, "span", "", "Date")}</span>` : ""}</p>`;
}

/* ------------------------------------------------------------------ the site around every page */

/** The work pages in the order the site shows them: the kind of work the template is for leads, the rest follow in the artist's order. */
export const workPages = (s: SiteDocument) => {
  const all = s.pages.filter((p) => p.kind === "story" || p.kind === "writing" || p.kind === "film" || p.kind === "project");
  const lead = house(s.house).leads as string[];
  return [...all.filter((p) => lead.includes(p.kind)), ...all.filter((p) => !lead.includes(p.kind))];
};
const shown = (c: Ctx) => workPages(c.site).filter((p) => p.inNav || c.editing);

function navLinks(c: Ctx, on: string) {
  const links: [string, string][] = [];
  if (workPages(c.site).length) links.push(["", house(c.site.house).menu]);
  for (const p of c.site.pages) if ((p.kind === "about" || p.kind === "contact" || p.kind === "record") && p.inNav) links.push([p.id, p.title]);
  return links.map(([id, t]) => `<a href="${c.href(id)}"${on === id ? ' aria-current="page"' : ""}>${esc(t)}</a>`).join("");
}
function bar(c: Ctx, on: string) {
  const logo = c.site.mark.logo && c.site.library[c.site.mark.logo] ? work(c, c.site.mark.logo) : null;
  const name = logo ? `<img class="logo" src="${esc(logo.src)}" alt="${esc(c.site.name)}" width="${logo.w}" height="${logo.h}" style="--r:${logo.r.toFixed(4)}">` : esc(c.site.name);
  return `<header class="bar"><a class="name${logo ? " has-logo" : ""}" href="${c.href("")}">${name}</a><nav aria-label="Primary">${navLinks(c, on)}</nav></header>`;
}
/** The foot of every page. It carries the menu too, for sites whose header shows only the name. */
function foot(c: Ctx, on: string) {
  return `<footer class="foot site-foot"><span class="foot-name">${esc(c.site.name)}</span><nav class="foot-nav" aria-label="Pages">${navLinks(c, on)}</nav><span class="label foot-line">${ed(c, "site.contact", c.site.contact, "span", "", "A line at the foot of every page")}</span><a class="mark" href="${c.home ?? "/design/home/index.html"}" aria-label="Made with Latent Wall">${MARK}</a></footer>`;
}
function next(c: Ctx, p: SitePage) {
  const list = shown(c), i = list.findIndex((x) => x.id === p.id);
  const n = list.length > 1 ? list[(i + 1) % list.length] : null;
  return n ? { page: n, html: `<a class="onward" href="${c.href(n.id)}"><span class="label">Next</span><span class="big">${plainTitle(n.title, n.titleEm)}</span></a>` } : { page: null, html: "" };
}

/* ------------------------------------------------------------------ covers: how a page shows on the front */

function coverOf(c: Ctx, p: SitePage): W | null {
  if (c.locked?.(p)) return null;
  const a = p.kind === "story" ? (p.pieces.find((x) => x.type === "work") as { asset: string } | undefined)?.asset
    : p.kind === "writing" ? p.image?.asset : p.kind === "film" ? p.poster ?? p.stills[0]?.asset : p.kind === "project" ? p.outcome[0] ?? p.process[0] : undefined;
  return a && c.site.library[a] ? work(c, a) : null;
}
function metaOf(p: SitePage) {
  if (p.kind === "story") { const n = p.pieces.filter((x) => x.type === "work").length; return [p.kicker, n === 1 ? "One work" : `${n} works`].filter(Boolean).join(" · "); }
  if (p.kind === "writing") return [p.form, p.place, p.year].filter(Boolean).join(" · ");
  if (p.kind === "film") return [p.form, p.year, p.runtime].filter(Boolean).join(" · ");
  if (p.kind === "project") return [p.discipline, p.client, p.year].filter(Boolean).join(" · ");
  return "";
}
const firstLines = (c: Ctx, p: SitePage) => (c.locked?.(p) ? "" : p.kind === "writing" ? (p.paras[0] ?? "").split("\n").slice(0, 4).join("\n") : "");

/* ------------------------------------------------------------------ the front page */

/** How the front page begins: words, an image held across the screen, the artist's name, or straight into the work. */
function frontCard(c: Ctx) {
  const f = c.site.front, open = c.site.theme.opening;
  const words = `<section class="card"><div><span class="label">${ed(c, "front.kicker", f.kicker, "span", "", "Above the title")}</span><h1>${titleOf(c, "front", f.title, f.titleEm)}</h1></div>${ed(c, "front.note", f.note, "p", "note", "A line or two to introduce the site")}</section>`;
  if (open === "work") return c.editing ? `<p class="opening-note">The front opens straight into the work. Its words are kept, and shown again with another opening.</p>` : `<h1 class="sr">${esc(c.site.name)}</h1>`;
  if (open === "name") return `<section class="card opening-name"><h1>${esc(c.site.name)}</h1>${ed(c, "front.note", f.note, "p", "note", "A line or two to introduce the site")}</section>`;
  if (open === "image") {
    const first = workPages(c.site).map((p) => coverOf(c, p)).find(Boolean);
    return (first ? `<div class="opening-image" style="--fx:${first.focal.x}%;--fy:${first.focal.y}%">${img(c, first, false)}</div>` : "") + words;
  }
  return words;
}
/** When a page was made: a story by its latest work, the others by their year. For the fronts that run in time. */
function dateOf(c: Ctx, p: SitePage): { when: string; t: number } {
  if (p.kind === "story") {
    const ds = p.pieces.flatMap((x) => (x.type === "work" ? [c.site.library[x.asset]?.date ?? ""] : [])).filter(Boolean).map((d) => ({ d, t: Date.parse(d) })).filter((x) => !Number.isNaN(x.t)).sort((a, b) => b.t - a.t);
    return ds[0] ? { when: ds[0].d, t: ds[0].t } : { when: p.kicker, t: 0 };
  }
  const y = "year" in p ? p.year : ""; return { when: y, t: y ? Date.parse(`${y}-07-01`) || 0 : 0 };
}
const KIND_WORD: Record<SitePage["kind"], string> = { story: "Photographs", writing: "Writing", film: "Film", project: "Project", about: "About", contact: "Contact", record: "Record" };
const lineOf = (c: Ctx, p: SitePage) => (c.locked?.(p) ? "" : "note" in p ? p.note : "synopsis" in p ? p.synopsis : "summary" in p ? p.summary : p.kind === "writing" ? (p.paras[0] ?? "").split("\n").slice(0, 2).join(" ") : "");
/** Journal: dated entries, newest first; a small cover, the title, a line. */
function frontJournal(c: Ctx, list: SitePage[]) {
  const rows = list.map((p) => ({ p, d: dateOf(c, p) })).sort((a, b) => b.d.t - a.d.t);
  return `<div class="f-journal"><ol>${rows.map(({ p, d }) => { const w = coverOf(c, p); return `<li class="${p.kind}${p.inNav ? "" : " off"}"><a href="${c.href(p.id)}"><span class="when label">${esc(d.when)}</span><span class="th">${w ? img(c, w) : ""}</span><span class="what"><h2>${plainTitle(p.title, p.titleEm)}</h2><p>${esc(lineOf(c, p)).slice(0, 220)}</p><span class="label">${esc(metaOf(p))}</span></span></a></li>`; }).join("")}</ol></div>`;
}
/** Catalogue: every work of every story, numbered through, with medium, dimensions and year. */
function frontCatalogue(c: Ctx, list: SitePage[]) {
  let n = 0;
  const sections = list.filter((p): p is StoryPage => p.kind === "story" && !c.locked?.(p)).map((p) => {
    const ws = p.pieces.flatMap((x) => (x.type === "work" && c.site.library[x.asset] ? [work(c, x.asset)] : []));
    return `<section class="cat-series"><h2><a href="${c.href(p.id)}">${plainTitle(p.title, p.titleEm)}</a><span class="label">${esc(p.kicker)}</span></h2><ol start="${n + 1}">${ws.map((w) => { n++; const s = w.size; return `<li><a href="${c.href(p.id)}"><span class="no">${n}</span><span class="th">${img(c, w)}</span><span class="t">${esc(w.title || "Untitled")}</span><span class="m">${esc(w.caption)}</span><span class="dim">${s ? `${cmText(s.w)} × ${cmText(s.h)} cm` : ""}</span><span class="y">${esc((w.date.match(/\d{4}/) ?? [""])[0])}</span></a></li>`; }).join("")}</ol></section>`;
  }).join("");
  const rest = list.filter((p) => p.kind !== "story");
  return `<div class="f-catalogue">${sections}${rest.length ? `<p class="also label">Also: ${rest.map((p) => `<a href="${c.href(p.id)}">${plainTitle(p.title, p.titleEm)}</a>`).join(" · ")}</p>` : ""}</div>`;
}
/** Reading: the writing itself, one piece after another, set large; everything else waits at the end. */
function frontReading(c: Ctx, list: SitePage[]) {
  const pieces = list.filter((p): p is Extract<SitePage, { kind: "writing" }> => p.kind === "writing" && !c.locked?.(p));
  const rest = list.filter((p) => p.kind !== "writing");
  return `<div class="f-reading">${pieces.map((p) => `<article class="piece"><header><span class="label">${esc([p.form, p.place, p.year].filter(Boolean).join(" · "))}</span><h2><a href="${c.href(p.id)}">${plainTitle(p.title, p.titleEm)}</a></h2></header>${p.paras.map((t) => `<p>${esc(t).replace(/\n/g, "<br>")}</p>`).join("")}</article>`).join("")}${rest.length ? `<nav class="after" aria-label="Also"><span class="label">Also</span>${rest.map((p) => `<a href="${c.href(p.id)}">${plainTitle(p.title, p.titleEm)}<small>${esc(metaOf(p))}</small></a>`).join("")}</nav>` : ""}</div>`;
}
/** Posters: every film as its poster at its own ratio; the rest beneath. */
function frontPosters(c: Ctx, list: SitePage[]) {
  const films = list.filter((p): p is Extract<SitePage, { kind: "film" }> => p.kind === "film");
  const rest = list.filter((p) => p.kind !== "film");
  return `<div class="f-posters"><div class="wall">${films.map((p) => { const w = coverOf(c, p); return `<a class="poster${p.inNav ? "" : " off"}" href="${c.href(p.id)}" style="--r:${w ? w.r.toFixed(4) : 0.7}">${w ? img(c, w) : `<span class="lines">${plainTitle(p.title, p.titleEm)}</span>`}<span class="bill"><b>${plainTitle(p.title, p.titleEm)}</b><span class="label">${esc([p.form, p.year, p.runtime].filter(Boolean).join(" · "))}</span></span></a>`; }).join("")}</div>${rest.length ? `<nav class="after" aria-label="Also"><span class="label">Also</span>${rest.map((p) => `<a href="${c.href(p.id)}">${plainTitle(p.title, p.titleEm)}<small>${esc(metaOf(p))}</small></a>`).join("")}</nav>` : ""}</div>`;
}
/** Ledger: a table of projects, clients, disciplines and years; each row opens the case. */
function frontLedger(c: Ctx, list: SitePage[]) {
  const rows = list.map((p, i) => { const pr = p.kind === "project" ? p : null; return `<tr class="${p.kind}${p.inNav ? "" : " off"}" data-href="${c.href(p.id)}"><td class="no">${n2(i + 1)}</td><td class="t"><a href="${c.href(p.id)}">${plainTitle(p.title, p.titleEm)}</a></td><td>${esc(pr ? pr.client : KIND_WORD[p.kind])}</td><td>${esc(pr ? pr.discipline : "form" in p ? p.form : p.kind === "story" ? p.kicker : "")}</td><td class="y">${esc(dateOf(c, p).when.match(/\d{4}/)?.[0] ?? "")}</td></tr>`; }).join("");
  return `<div class="f-ledger"><table><thead><tr><th class="no">No.</th><th>Project</th><th>Client</th><th>Discipline</th><th class="y">Year</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
/** Archive: every page by date, newest first, with its kind; sifted by kind. */
function frontArchive(c: Ctx, list: SitePage[]) {
  const rows = list.map((p) => ({ p, d: dateOf(c, p) })).sort((a, b) => b.d.t - a.d.t);
  const kinds = [...new Set(list.map((p) => p.kind))];
  return `<div class="f-archive"><nav class="kinds" aria-label="Sift by kind"><button type="button" class="label on" data-kind="">All</button>${kinds.map((k) => `<button type="button" class="label" data-kind="${k}">${KIND_WORD[k]}</button>`).join("")}</nav><ol>${rows.map(({ p, d }) => { const w = coverOf(c, p); return `<li class="${p.kind}${p.inNav ? "" : " off"}" data-kind="${p.kind}"><a href="${c.href(p.id)}"><span class="when label">${esc(d.when)}</span><span class="kind label">${KIND_WORD[p.kind]}</span><span class="th">${w ? img(c, w) : ""}</span><span class="what"><h2>${plainTitle(p.title, p.titleEm)}</h2><span class="m">${esc(metaOf(p))}</span></span></a></li>`; }).join("")}</ol></div>`;
}
function front(c: Ctx) {
  const list = shown(c);
  let body = "";
  if (!list.length) body = `<div class="empty">${c.editing ? "No work yet. Add a story, a film, some writing or a project from Edit." : ""}</div>`;
  else if (c.site.front.form === "walk") return frontWalk(c, list);
  else if (c.site.front.form === "journal") body = frontJournal(c, list);
  else if (c.site.front.form === "catalogue") body = frontCatalogue(c, list);
  else if (c.site.front.form === "reading") body = frontReading(c, list);
  else if (c.site.front.form === "posters") body = frontPosters(c, list);
  else if (c.site.front.form === "ledger") body = frontLedger(c, list);
  else if (c.site.front.form === "archive") body = frontArchive(c, list);
  else if (c.site.front.form === "list" || c.site.front.form === "threshold") {
    const book = c.site.house === "monograph" || c.site.house === "manuscript";
    body = `<div class="f-list"${c.site.front.form === "threshold" ? ' id="contents"' : ""}><ol${book ? ' aria-label="Contents"' : ""}>${book ? '<li class="contents-h"><span class="label">Contents</span></li>' : ""}${list.map((p, i) => `<li class="${p.kind}${p.inNav ? "" : " off"}"><a href="${c.href(p.id)}" data-i="${i}"><span class="n">${n2(i + 1)}</span><h2>${plainTitle(p.title, p.titleEm)}</h2><span class="m">${esc(metaOf(p))}</span></a></li>`).join("")}</ol><div class="f-show" aria-hidden="true">${listShow(c, list[0])}</div></div>`;
  } else if (c.site.front.form === "sheet") {
    body = `<div class="f-sheet">${list.map((p) => { const w = coverOf(c, p); return `<a class="${p.kind}${p.inNav ? "" : " off"}" href="${c.href(p.id)}"><span class="fr">${w ? img(c, w) : `<span class="lines">${esc(firstLines(c, p))}</span>`}</span><h2>${plainTitle(p.title, p.titleEm)}</h2><span class="label">${esc(metaOf(p))}</span></a>`; }).join("")}</div>`;
  } else {
    body = `<div class="f-covers">${list.map((p, i) => { const w = coverOf(c, p); return `<a class="cover ${p.kind}${p.inNav ? "" : " off"}" href="${c.href(p.id)}" style="--r:${w ? w.r.toFixed(4) : 1.5}">${w ? img(c, w, i > 0) : `<span class="lines">${esc(firstLines(c, p))}</span>`}<span class="under"><h2>${plainTitle(p.title, p.titleEm)}</h2><span class="label">${esc(metaOf(p))}</span></span></a>`; }).join("")}</div>`;
  }
  if (c.site.front.form === "threshold") return `<main class="v-front v-threshold">${threshold(c, list)}${body}</main>`;
  return `<main class="v-front">${frontCard(c)}${body}</main>`;
}
/** The threshold: a book's title page. The cover when there is one, the title, the subtitle, and "Begin"; the contents follow below. */
function threshold(c: Ctx, list: SitePage[]) {
  const f = c.site.front, cover = c.site.appears.share && c.site.library[c.site.appears.share] ? work(c, c.site.appears.share) : null, first = list[0];
  return `<section class="threshold">${cover ? `<figure class="cover" style="--r:${cover.r.toFixed(4)}"><div class="frame">${img(c, cover, false)}</div></figure>` : ""}<div class="tp"><span class="label">${ed(c, "front.kicker", f.kicker, "span", "", "Above the title: an edition, a year")}</span><h1>${titleOf(c, "front", f.title, f.titleEm)}</h1>${ed(c, "front.note", f.note, "p", "sub", "A line under the title")}<p class="begin">${first ? `<a class="go" href="${c.href(first.id)}">Begin the work &rarr;</a>` : ""}<a class="label" href="${c.href("")}#contents">Contents</a></p></div></section>`;
}
/** The book's leaves, in order: every story's title, words and works, every writing and film as one leaf; projects are another wing. */
export function manuscriptLeaves(c: Ctx): { page: SitePage; n: number }[] {
  return shown(c).filter((p) => p.kind === "story" || p.kind === "writing" || p.kind === "film").map((p) => ({ page: p, n: p.kind === "story" ? slideList(c, p as StoryPage).list.length : 1 }));
}
/** A leaf's address: the page, and which leaf of it. */
export function leafHref(c: Ctx, id: string, l: number): string { const h = c.href(id); return h.includes("#") ? `${h}?l=${l}` : `${h}#l=${l}`; }
/** Passage's front page: the work itself hung along one wall, each story's cover a door into it. */
function frontWalk(c: Ctx, list: SitePage[]) {
  const f = c.site.front;
  let h = `<section class="wall-text title"><span class="label">${ed(c, "front.kicker", f.kicker, "span", "", "Above the title")}</span><h1>${titleOf(c, "front", f.title, f.titleEm)}</h1>${ed(c, "front.note", f.note, "p", "", "A line or two to introduce the site")}</section>`;
  list.forEach((p, i) => {
    const w = coverOf(c, p);
    h += w ? `<a class="hang door${w.r < 1 ? " tall" : ""}" href="${c.href(p.id)}" style="--r:${w.r.toFixed(4)}" data-n="${n2(i + 1)}" data-k="${w.k}">${img(c, w, i > 1)}<span class="cap"><span class="n">${n2(i + 1)}</span><span>${esc([p.title, p.titleEm].filter(Boolean).join(" "))}</span><span class="d">${esc(metaOf(p))}</span></span></a>`
      : `<a class="wall-text say door" href="${c.href(p.id)}" data-n="${n2(i + 1)}"><span class="label">${esc(metaOf(p))}</span><p>${esc([p.title, p.titleEm].filter(Boolean).join(" "))}</p></a>`;
  });
  return `<main class="v-passage v-front-walk"><div class="walk" tabindex="0" aria-label="The work, hung in order. Scroll or use the arrow keys to walk along it.">${h}</div><footer class="rail"><span class="label">${esc(c.site.name)}</span><div class="line"><i></i></div><span class="label at"></span></footer></main>`;
}

export function listShow(c: Ctx, p: SitePage | undefined) {
  if (!p) return "";
  const w = coverOf(c, p);
  return (w ? img(c, w, false) : `<span class="lines">${esc(firstLines(c, p))}</span>`) + `<p class="cap"><span class="n">${esc(metaOf(p))}</span></p>`;
}

/** Board: many works pinned close on one wall, at their own proportions, the larger ones across two columns. */
function board(c: Ctx, p: StoryPage) {
  const { groups: G } = groups(c, p);
  let i = 0;
  const pins = G.map((g) => {
    if (g.type === "pause") return `<div class="pin say"><span class="label">${pauseLabel(c, p, g)}</span>${pauseText(c, p, g)}</div>`;
    return g.works.map((w) => { const big = p.pieces[w.k]?.type === "work" && (p.pieces[w.k] as { full: boolean }).full; const h = `<figure class="pin${big ? " big" : ""}" style="--r:${w.r.toFixed(4)}" data-view="${i}" data-k="${w.k}"><div class="frame">${img(c, w)}${verso(c, w)}${mark(c, p, w)}</div><figcaption>${cap(c, w, false)}</figcaption></figure>`; i++; return h; }).join("") + (c.editing ? gap(c, p, g.k) : "");
  }).join("");
  return `<main class="v-board">${storyCard(c, p)}<div class="pins">${pins}</div>${c.editing ? gap(c, p, p.pieces.length - 1, true) : ""}${next(c, p).html}</main>`;
}

/* ------------------------------------------------------------------ stories */

type Group = { type: "single" | "pair" | "note" | "pause"; works: W[]; k: number; label?: string; text?: string; note?: string };

/** Intent into groups: a pair only of two landscape works, a margin note only beside a portrait. */
export function groups(c: Ctx, p: StoryPage): { works: W[]; groups: Group[] } {
  const works: W[] = [], items: (W | { pause: true; k: number; label: string; text: string })[] = [];
  p.pieces.forEach((x: Piece, k) => {
    if (x.type === "pause") items.push({ pause: true, k, label: x.label, text: x.text });
    else if (c.site.library[x.asset]) { const w = Object.assign(work(c, x.asset, k, works.length + 1), { arrange: x.arrange, note: x.note, full: x.full }); works.push(w); items.push(w); }
  });
  const out: Group[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if ("pause" in it) { out.push({ type: "pause", works: [], k: it.k, label: it.label, text: it.text }); continue; }
    const w = it as W & { arrange: string; note: string; full: boolean }, nx = items[i + 1] as (W & { arrange: string }) | undefined;
    if (w.arrange === "with-next" && w.r >= 1 && nx && !("pause" in nx) && nx.r >= 1) { out.push({ type: "pair", works: [w, nx], k: w.k }); i++; }
    else if (w.arrange === "margin-note" && (w.r < 1 || p.arrangement === "passage" || p.arrangement === "slides")) out.push({ type: "note", works: [w], k: w.k, note: w.note });
    else out.push({ type: "single", works: [w], k: w.k });
  }
  return { works, groups: out };
}
const isFull = (w: W) => !!(w as W & { full?: boolean }).full;

function storyCard(c: Ctx, p: StoryPage) {
  return `<section class="card"><div><span class="label">${ed(c, `page:${p.id}.kicker`, p.kicker, "span", "", "Above the title: a season, a place")}</span><h1>${titleOf(c, `page:${p.id}`, p.title, p.titleEm)}</h1></div>${ed(c, `page:${p.id}.note`, p.note, "p", "note", "A line or two to introduce it")}</section>`;
}
const pauseLabel = (c: Ctx, p: StoryPage, g: Group) => ed(c, `piece:${p.id}:${g.k}.label`, g.label ?? "", "span", "label", "A label");
const pauseText = (c: Ctx, p: StoryPage, g: Group, tag = "p") => ed(c, `piece:${p.id}:${g.k}.text`, g.text ?? "", tag, "", "A few words");
const noteText = (c: Ctx, p: StoryPage, g: Group, tag = "p", cls = "") => ed(c, `piece:${p.id}:${g.k}.note`, g.note ?? "", tag, cls, "A note beside it");
/** The editor's marks for a work: drawn only in edit mode, filled in by the editor. */
const mark = (c: Ctx, p: StoryPage, w: W) => (c.editing ? `<span class="tb-slot" data-page="${p.id}" data-k="${w.k}"></span>` : "");
const gap = (c: Ctx, p: StoryPage, after: number, end = false) => (c.editing ? `<div class="addrow${end ? " end" : ""}"><button type="button" data-act="add-works" data-page="${p.id}" data-after="${after}">${end ? "+ Add works" : "+"}</button></div>` : "");

function held(c: Ctx, p: StoryPage) {
  const { groups: G } = groups(c, p);
  const fig = (w: W, lazy: boolean) => `<figure style="--r:${w.r.toFixed(4)}" data-k="${w.k}"><div class="frame">${img(c, w, lazy)}${verso(c, w)}${mark(c, p, w)}</div><figcaption>${cap(c, w)}</figcaption></figure>`;
  let h = "";
  G.forEach((g, i) => {
    const lazy = i > 0;
    if (g.type === "pause") h += `<div class="interlude">${pauseLabel(c, p, g)}${pauseText(c, p, g)}</div>`;
    else if (g.type === "pair") h += `<div class="work pair">${g.works.map((w) => fig(w, lazy)).join("")}</div>`;
    else if (g.type === "note") h += `<div class="work split" style="--r:${g.works[0].r.toFixed(4)}"><div class="side">${noteText(c, p, g)}</div>${fig(g.works[0], lazy)}<div class="side"></div></div>`;
    else h += `<div class="work single${isFull(g.works[0]) ? " full" : ""}">${fig(g.works[0], lazy)}</div>`;
    const end = g.type === "pair" ? g.works[1].k : g.k;
    if (i < G.length - 1) h += gap(c, p, end);
  });
  h += gap(c, p, p.pieces.length - 1, true);
  return `<main class="v-held">${storyCard(c, p)}<div class="seq">${h}</div>${next(c, p).html}</main>`;
}

/** Book: spreads of two pages. Built as leaves; the behaviour layer turns them. */
export function bookLeaves(c: Ctx, p: StoryPage, one: boolean) {
  const { groups: G } = groups(c, p), out: string[] = [];
  const pg = (h: string, cls = "") => `<div class="pg ${cls}">${h}</div>`;
  const plate = (w: W, extra = "") => `<figure data-k="${w.k}"><div class="in"><div class="frame">${img(c, w, false)}${verso(c, w)}${mark(c, p, w)}</div>${cap(c, w)}${extra}</div></figure>`;
  const bare = (w: W) => `<figure data-k="${w.k}"><div class="in"><div class="frame">${img(c, w, false)}${verso(c, w)}${mark(c, p, w)}</div></div></figure>`;
  const top = `<div class="top"><span class="label">${ed(c, `page:${p.id}.kicker`, p.kicker, "span", "", "Above the title")}</span></div>`, h1 = `<h1>${titleOf(c, `page:${p.id}`, p.title, p.titleEm)}</h1>`;
  const note = ed(c, `page:${p.id}.note`, p.note, "p", "", "A line or two to introduce it");
  out.push(one ? pg(`${top}<div class="low">${h1}${note}</div>`) : pg(`${top}<div class="low">${note}</div>`) + pg(`<div class="low">${h1}</div>`));
  for (const g of G) {
    const a = g.works[0];
    if (g.type === "pause") out.push(one ? pg(`<div class="top">${pauseLabel(c, p, g)}</div><div class="say">${pauseText(c, p, g)}</div>`) : pg(`<div class="foot2">${pauseLabel(c, p, g)}</div>`) + pg(`<div class="say">${pauseText(c, p, g)}</div>`));
    else if (g.type === "pair") { if (one) g.works.forEach((w) => out.push(pg(plate(w)))); else out.push(pg(plate(a)) + pg(plate(g.works[1]))); }
    else if (isFull(a) && !one) out.push(pg(plate(a), "wide"));
    else if (one) out.push(pg(plate(a, g.type === "note" ? noteText(c, p, g, "p", "aside") : "")));
    else out.push(pg(`<div class="foot2">${g.type === "note" ? noteText(c, p, g, "p", "aside") : ""}${cap(c, a)}</div>`) + pg(bare(a)));
  }
  if (!G.length) out.push(pg(`<div class="say"><p class="soft">${c.editing ? "No works yet." : ""}</p></div>`));
  const n = next(c, p);
  if (n.html) { const o = `<div class="low">${n.html}</div>`; out.push(one ? pg(o) : pg("") + pg(o)); }
  return out;
}
const book = (_c: Ctx, p: StoryPage) => `<main class="v-book" data-page="${p.id}"><div class="stage"><div class="spread" id="spread" aria-live="polite"></div></div><div class="turn"><button type="button" class="prev" aria-label="Previous pages">&#8249;</button><span class="label count"></span><button type="button" class="next" aria-label="Next pages">&#8250;</button></div></main>`;

function passage(c: Ctx, p: StoryPage) {
  const { groups: G } = groups(c, p);
  const hang = (w: W, cls = "", aside = "") => `<figure class="hang${w.r < 1 ? " tall" : ""}${cls}" style="--r:${w.r.toFixed(4)}" data-k="${w.k}" data-n="${w.n}">${aside}<div class="frame">${img(c, w)}${verso(c, w)}${mark(c, p, w)}</div><figcaption>${cap(c, w)}</figcaption></figure>`;
  let h = `<section class="wall-text title"><span class="label">${ed(c, `page:${p.id}.kicker`, p.kicker, "span", "", "Above the title")}</span><h1>${titleOf(c, `page:${p.id}`, p.title, p.titleEm)}</h1>${ed(c, `page:${p.id}.note`, p.note, "p", "", "A line or two to introduce it")}</section>`;
  for (const g of G) {
    if (g.type === "pause") h += `<section class="wall-text say">${pauseLabel(c, p, g)}${pauseText(c, p, g)}</section>`;
    else if (g.type === "pair") h += hang(g.works[0]) + hang(g.works[1], " close");
    else h += hang(g.works[0], g.type === "note" ? " noted" : "", g.type === "note" ? noteText(c, p, g, "p", "aside") : "");
  }
  const n = next(c, p);
  if (n.html) h += `<section class="wall-text end">${n.html}</section>`;
  return `<main class="v-passage"><div class="walk" tabindex="0" aria-label="The story, hung in order. Scroll or use the arrow keys to walk along it.">${h}</div><footer class="rail"><span class="label">${esc([p.title, p.titleEm].filter(Boolean).join(" "))}</span><div class="line"><i></i></div><span class="label at"></span></footer></main>`;
}

function contact(c: Ctx, p: StoryPage) {
  const { works, groups: G } = groups(c, p), pause = G.find((g) => g.type === "pause");
  const cells = works.map((w) => `<li><div class="cell"><button type="button" class="fr" data-hold="${w.n}" aria-label="${esc(`${w.n}, ${w.title}`)}">${img(c, w)}</button>${mark(c, p, w)}${cap(c, w, false)}</div></li>`).join("");
  return `<main class="v-contact" data-page="${p.id}"><section class="head"><div><span class="label">${ed(c, `page:${p.id}.kicker`, p.kicker, "span", "", "Above the title")}</span><h1>${titleOf(c, `page:${p.id}`, p.title, p.titleEm)}</h1></div>${ed(c, `page:${p.id}.note`, p.note, "p", "", "A line or two to introduce it")}</section>` +
    (works.length ? `<ol class="sheet">${cells}</ol>` : `<div class="empty">${c.editing ? "No works yet." : ""}</div>`) + gap(c, p, p.pieces.length - 1, true) +
    (pause ? `<section class="epi">${pauseLabel(c, p, pause)}${pauseText(c, p, pause)}</section>` : "") + next(c, p).html +
    `<div class="held" role="dialog" aria-modal="true" aria-label="One work, held large" hidden><div class="top"><button type="button" class="back">&larr; The sheet</button><span class="label where"></span></div><div class="mid"></div><div class="strip">${works.map((w) => `<button type="button" data-hold="${w.n}" aria-label="${esc(`${w.n}, ${w.title}`)}"><img src="${esc(w.src)}" alt="" loading="lazy"></button>`).join("")}</div></div></main>`;
}

/** Wall: works hung together at their true relative size, on one eye line. A wall never runs wider than four metres. */
export const WALL_CM = 400, GAP_CM = 14, DEFAULT_LONG_CM = 60;
export const cmOf = (w: W) => w.size ?? (w.r >= 1 ? { w: DEFAULT_LONG_CM, h: Math.round((DEFAULT_LONG_CM / w.r) * 10) / 10 } : { w: Math.round(DEFAULT_LONG_CM * w.r * 10) / 10, h: DEFAULT_LONG_CM });
const cmText = (n: number) => String(Math.round(n * 10) / 10).replace(/\.0$/, "");
function wall(c: Ctx, p: StoryPage) {
  const works = groups(c, p).works as (W & { arrange: string })[];
  const walls: (W & { arrange: string })[][] = [];
  let cur: (W & { arrange: string })[] = [], width = 0;
  for (const w of works) {
    const cw = cmOf(w).w, add = cur.length ? GAP_CM : 0;
    if (cur.length && width + add + cw > WALL_CM) { walls.push(cur); cur = []; width = 0; }
    cur.push(w); width += (cur.length > 1 ? GAP_CM : 0) + cw;
    if (w.arrange !== "with-next") { walls.push(cur); cur = []; width = 0; }
  }
  if (cur.length) walls.push(cur);
  // one scale for the whole page, so sizes stay true to one another: the widest wall the story really has fills the width
  const widest = Math.max(1, ...walls.map((ws) => ws.reduce((s, w, i) => s + cmOf(w).w + (i ? GAP_CM : 0), 0)));
  const biggest = Math.max(1, ...works.map((w) => cmOf(w).w)), tallest = Math.max(1, ...works.map((w) => cmOf(w).h));
  let n = 0;
  const hangs = walls.map((ws) => {
    const figs = ws.map((w) => { n++; const s = cmOf(w); return `<figure class="art" style="--cw:${s.w}" data-view="${n - 1}" data-k="${w.k}"><div class="frame">${img(c, w)}${verso(c, w)}${mark(c, p, w)}</div><span class="no">${n}</span><span class="cap-m">${esc(w.title)}, ${cmText(s.w)} × ${cmText(s.h)} cm</span></figure>`; }).join("");
    const key = ws.map((w, i) => { const s = cmOf(w), k = n - ws.length + i + 1; return `<li><span class="k">${k}</span><span>${ed(c, `work:${w.asset}.title`, w.title, "b", "", "Title")}${w.caption || c.editing ? ", " + ed(c, `work:${w.asset}.caption`, w.caption, "span", "", "Medium") : ""}, <span class="sz">${cmText(s.w)} × ${cmText(s.h)} cm</span>${w.date || c.editing ? ", " + ed(c, `work:${w.asset}.date`, w.date, "span", "", "Year") : ""}</span></li>`; }).join("");
    return `<section class="hang-wall"><div class="wall">${figs}</div><ol class="key">${key}</ol></section>`;
  }).join("");
  return `<main class="v-wall">${storyCard(c, p)}<div class="salon" style="--widest:${widest};--tallest:${tallest};--maxcm:${biggest}">${hangs || `<div class="empty">${c.editing ? "No works yet." : ""}</div>`}${gap(c, p, p.pieces.length - 1, true)}</div>${next(c, p).html}</main>`;
}

/** Slides: one at a time, like a lantern show. A title slide first. */
export function slideList(c: Ctx, p: StoryPage) {
  const { groups: G } = groups(c, p), list: string[] = [], thumbs: string[] = [];
  list.push(`<div class="slide title">${storyCard(c, p)}</div>`); thumbs.push(`<span class="t0">Title</span>`);
  for (const g of G) {
    if (g.type === "pause") { list.push(`<div class="slide words">${pauseLabel(c, p, g)}${pauseText(c, p, g)}</div>`); thumbs.push(`<span class="t0">&ldquo;&rdquo;</span>`); continue; }
    for (const w of g.works) { list.push(`<div class="slide"><figure data-k="${w.k}"><div class="frame">${img(c, w, false)}${verso(c, w)}${mark(c, p, w)}</div><figcaption>${cap(c, w)}</figcaption></figure>${g.type === "note" ? noteText(c, p, g, "p", "label") : ""}</div>`); thumbs.push(`<img src="${esc(w.src)}" alt="" loading="lazy">`); }
  }
  return { list, thumbs };
}
/** Leaves: a story read one leaf at a time, as part of the whole book; the running head says where you are, the turns carry on into the next page. */
const leaves = (c: Ctx, p: StoryPage) => `<main class="v-leaves" data-page="${p.id}"><header class="runhead"><a class="label" href="${c.href("")}#contents">Contents</a><span class="label where">${plainTitle(p.title, p.titleEm)}</span><span class="label at"></span></header><div class="stage" aria-live="polite"></div><nav class="turns" aria-label="Turn"><a class="label back" href="#">&larr; Turn back</a><a class="label fwd" href="#">Turn &rarr;</a></nav>${gap(c, p, p.pieces.length - 1, true)}</main>`;
const slides = (c: Ctx, p: StoryPage) => `<main class="v-slides" data-page="${p.id}"><div class="show"><div class="stage" aria-roledescription="slideshow" aria-live="polite"></div><div class="thumbs" role="group" aria-label="All slides"></div></div>${gap(c, p, p.pieces.length - 1, true)}${next(c, p).html}</main>`;

/* ------------------------------------------------------------------ writing, film, project, about, contact */

function writing(c: Ctx, p: Extract<SitePage, { kind: "writing" }>) {
  const form = /poem/i.test(p.form) ? "poem" : /essay/i.test(p.form) ? "prose" : "fragment";
  const im = p.image && c.site.library[p.image.asset] ? work(c, p.image.asset) : null;
  const fig = im ? `<figure style="--r:${im.r.toFixed(4)}"><div class="frame">${img(c, im)}</div>${im.title || c.editing ? `<figcaption>${ed(c, `work:${im.asset}.title`, im.title, "span", "", "A caption")}</figcaption>` : ""}</figure>` : "";
  let body = "";
  if (form === "poem") body = ed(c, `page:${p.id}.para.0`, p.paras[0] ?? "", "p", "poem", "Write here");
  else p.paras.forEach((t, i) => { body += ed(c, `page:${p.id}.para.${i}`, t, "p", "", "Write here"); if (im && p.image!.at === i + 1) body += fig; });
  const meta = [ed(c, `page:${p.id}.form`, p.form, "span", "", "Form"), ed(c, `page:${p.id}.place`, p.place, "span", "", "Place"), ed(c, `page:${p.id}.year`, p.year, "span", "", "Year")].filter(Boolean).join(" · ");
  return `<main class="v-writing"><article class="piece"><header><span class="label">${meta}</span><h1>${titleOf(c, `page:${p.id}`, p.title, p.titleEm)}</h1></header>${im && p.image!.at === "cover" ? fig : ""}<div class="${form}">${body}</div>${p.margin || c.editing ? `<p class="margin">${ed(c, `page:${p.id}.margin`, p.margin, "span", "", "A note under the piece")}</p>` : ""}</article>${next(c, p).html}</main>`;
}

function film(c: Ctx, p: Extract<SitePage, { kind: "film" }>) {
  const r = ratioNumber(p.ratio || "16:9"), poster = p.poster && c.site.library[p.poster] ? work(c, p.poster) : null;
  const video = p.video && c.site.library[p.video] ? c.src(p.video) : "";
  let screen = poster ? img(c, poster, false) : `<div class="none">${c.editing ? "Add a poster" : ""}</div>`;
  if (video) screen += `<button type="button" class="play" data-play="${esc(video)}" aria-label="Play ${esc(p.title)}"><i></i></button>`;
  else if (p.link) screen += `<a class="watch" href="${esc(p.link)}" target="_blank" rel="noopener">Watch</a>`;
  const stills = p.stills.filter((s) => c.site.library[s.asset]).map((s, i) => { const w = work(c, s.asset); return `<figure><img src="${esc(w.src)}" width="${w.w}" height="${w.h}" alt="${esc(w.alt || s.caption || p.title)}" loading="lazy" data-still="${i}"></figure>`; }).join("");
  const meta = [ed(c, `page:${p.id}.form`, p.form, "span", "", "Form"), ed(c, `page:${p.id}.year`, p.year, "span", "", "Year"), ed(c, `page:${p.id}.runtime`, p.runtime, "span", "", "Length"), esc(p.ratio)].filter(Boolean).join(" · ");
  const credits = c.editing ? ed(c, `page:${p.id}.credits`, p.credits.join("\n"), "div", "credits-edit", "Credits, one per line") : p.credits.length ? `<ul class="credits">${p.credits.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
  return `<main class="v-film" style="--r:${r.toFixed(4)}"><div class="screen" style="--r:${r.toFixed(4)}">${screen}</div><div class="info"><div><span class="label">${meta}</span><h1>${titleOf(c, `page:${p.id}`, p.title, p.titleEm)}</h1></div><div>${ed(c, `page:${p.id}.synopsis`, p.synopsis, "p", "syn", "A line or two about the film")}${credits}</div></div>${stills ? `<div class="stills">${stills}</div>` : ""}${next(c, p).html}</main>`;
}

function project(c: Ctx, p: Extract<SitePage, { kind: "project" }>) {
  const fig = (a: string, i: number, numbered: boolean) => { const w = work(c, a); return `<figure class="fig"><div class="frame">${img(c, w)}</div><figcaption>${numbered ? `<span class="n">${n2(i + 1)}</span>` : "<span></span>"}<span>${ed(c, `work:${a}.title`, w.title, "b", "", "Label")}${w.caption || c.editing ? ". " + ed(c, `work:${a}.caption`, w.caption, "span", "", "A line about it") : ""}</span></figcaption></figure>`; };
  const out = p.outcome.filter((a) => c.site.library[a]), proc = p.process.filter((a) => c.site.library[a]);
  const facts = c.editing ? ed(c, `page:${p.id}.facts`, p.facts.join("\n"), "div", "facts-edit", "Role: …  (one fact per line)") : p.facts.length ? `<dl class="facts">${p.facts.map((t) => { const k = t.indexOf(":"); return k > 0 ? `<dt>${esc(t.slice(0, k))}</dt><dd>${esc(t.slice(k + 1).trim())}</dd>` : `<dt></dt><dd>${esc(t)}</dd>`; }).join("")}</dl>` : "";
  let compare = "";
  if (p.compare && out[0] && proc[0]) { const o = work(c, out[0]), s = work(c, proc[0]); compare = `<div class="cmp"><div class="col-h"><span>Process, set against the outcome</span><span>Drag, or use the arrow keys</span></div><div class="compare" style="--cr:${o.r.toFixed(4)}"><img src="${esc(o.src)}" alt="${esc(o.alt)}" loading="lazy"><img class="over" src="${esc(s.src)}" alt="${esc(s.alt)}" loading="lazy"><input type="range" min="0" max="100" value="50" aria-label="Compare the first process step with the outcome"><span class="knob"></span><span class="tag l">${esc(s.title || "Process")}</span><span class="tag r">${esc(o.title || "Outcome")}</span></div></div>`; }
  const meta = [ed(c, `page:${p.id}.discipline`, p.discipline, "span", "", "Kind"), ed(c, `page:${p.id}.client`, p.client, "span", "", "Client"), ed(c, `page:${p.id}.year`, p.year, "span", "", "Year")].filter(Boolean).join(" · ");
  return `<main class="v-project"><article class="proj"><div class="ph"><div><span class="label">${meta}</span><h1>${titleOf(c, `page:${p.id}`, p.title, p.titleEm)}</h1></div><div>${ed(c, `page:${p.id}.summary`, p.summary, "p", "sum", "What the project was")}${facts}</div></div>` +
    `<div class="cols${proc.length || c.editing ? "" : " no-process"}">${proc.length || c.editing ? `<div><div class="col-h"><span>Process</span><span>${proc.length ? `${proc.length} steps` : "none yet"}</span></div><div class="steps">${proc.map((a, i) => fig(a, i, true)).join("")}</div></div>` : ""}<div class="col-out"><div class="col-h"><span>Outcome</span><span>${out.length}</span></div><div class="outcome">${out[0] ? fig(out[0], 0, false) : ""}</div></div></div>` +
    `${out.length > 1 ? `<div class="more">${out.slice(1).map((a, i) => fig(a, i + 1, false)).join("")}</div>` : ""}${compare}</article>${next(c, p).html}</main>`;
}

function words(c: Ctx, p: Extract<SitePage, { kind: "about" | "contact" }>) {
  const paras = p.paras.map((t, i) => ed(c, `page:${p.id}.para.${i}`, t, "p", "", "A paragraph")).join("");
  const prin = p.kind === "about" && p.principles.length ? `<ol class="principles">${p.principles.map((t, i) => `<li>${ed(c, `page:${p.id}.principle.${i}`, t, "span", "", "A principle")}</li>`).join("")}</ol>` : "";
  return `<main class="v-words"><section class="words"><div><h1>${ed(c, `page:${p.id}.title`, p.title, "span", "", "Title")}</h1></div><div class="body">${paras}</div></section>${prin}</main>`;
}

/* ------------------------------------------------------------------ one page */

export type View = "front" | "held" | "book" | "passage" | "contact" | "wall" | "slides" | "board" | "leaves" | "writing" | "film" | "project" | "words";

export function viewOf(p: SitePage | null, s?: SiteDocument): View {
  if (!p) return s?.front.form === "walk" ? "passage" : "front";
  if (p.kind === "story") return p.arrangement;
  if (p.kind === "about" || p.kind === "contact" || p.kind === "record") return "words";
  return p.kind;
}

/** The door: what a visitor meets before a page they may not see yet. A holding page for "soon"; a line and a word for a page behind one. */
export function door(c: Ctx, p: SitePage | null, why: "soon" | "word"): string {
  const s = c.site, form = `<form class="door-form" data-door autocomplete="off"><label><span class="label">The word</span><input type="password" name="word" autocomplete="off" autocapitalize="none" spellcheck="false" required></label><button type="submit" class="label">Open</button><p class="wrong label" hidden>Not that word.</p></form>`;
  if (why === "soon") return `<main class="v-door" data-why="soon"><section class="door"><h1>${esc(s.name)}</h1><p class="note">${esc(s.door.note || "Soon.")}</p>${s.door.word ? form : ""}</section></main>`;
  const title = p ? plainTitle(p.title, p.titleEm) : esc(s.name);
  return `<main class="v-door" data-why="word"><section class="door"><h1>${title}</h1><p class="note">${s.door.word ? "This site is shown to those who have the word." : "This page is shown to those who have the word."}</p>${form}</section></main>`;
}
/** The record: a statement, then the dated lists, each a section with the year in a margin. */
function record(c: Ctx, p: Extract<SitePage, { kind: "record" }>) {
  const paras = p.paras.map((t, i) => ed(c, `page:${p.id}.para.${i}`, t, "p", "", i ? "Another paragraph" : "A statement: what the work is, and why")).join("");
  const secs = p.sections.map((sec, n) => `<section class="rsec"><h2 class="label">${ed(c, `page:${p.id}.section.${n}.title`, sec.title, "span", "", "Section")}</h2>${sec.entries.length ? `<ol>${sec.entries.map((e, m) => `<li><span class="yr">${ed(c, `page:${p.id}.entry.${n}.${m}.year`, e.year, "span", "", "Year")}</span><span class="tx">${ed(c, `page:${p.id}.entry.${n}.${m}.text`, e.text, "span", "", "What, where")}</span></li>`).join("")}</ol>` : c.editing ? `<p class="none">Nothing here yet; add entries in the panel.</p>` : ""}</section>`).join("");
  return `<main class="v-words v-record"><section class="words"><div><h1>${ed(c, `page:${p.id}.title`, p.title, "span", "", "Title")}</h1></div><div class="body">${paras}</div></section>${secs ? `<div class="record">${secs}</div>` : ""}</main>`;
}
export function page(c: Ctx, p: SitePage | null): string {
  const on = !p || workPages(c.site).some((x) => x.id === p.id) ? "" : p.id;
  let main: string;
  const why = c.locked?.(p);
  if (why === "soon") return door(c, p, why);
  if (why === "word") return bar(c, on) + door(c, p, why) + foot(c, on);
  if (!p) main = front(c);
  else if (p.kind === "story") main = { held, book, passage, contact, wall, slides, board, leaves }[p.arrangement](c, p);
  else if (p.kind === "writing") main = writing(c, p);
  else if (p.kind === "film") main = film(c, p);
  else if (p.kind === "project") main = project(c, p);
  else if (p.kind === "record") main = record(c, p);
  else main = words(c, p);
  // in a Manuscript a writing or a film is a leaf of the book: the running head above it, the turns below, in place of "Next"
  if (c.site.house === "manuscript" && p && (p.kind === "writing" || p.kind === "film")) main = main.replace(/<a class="onward"[\s\S]*?<\/a>/, "").replace(/^(<main[^>]*)>/, `$1 data-leaf-page="${esc(p.id)}"><header class="runhead"><a class="label" href="${c.href("")}#contents">Contents</a><span class="label where">${plainTitle(p.title, p.titleEm)}</span><span class="label at"></span></header>`).replace(/<\/main>$/, `<nav class="turns" aria-label="Turn"><a class="label back" href="#">&larr; Turn back</a><a class="label fwd" href="#">Turn &rarr;</a></nav></main>`);
  const v = viewOf(p, c.site);
  return bar(c, on) + main + (v === "book" || v === "passage" ? "" : foot(c, on));
}

export function titleText(s: SiteDocument, p: SitePage | null) {
  return p ? `${[p.title, p.titleEm].filter(Boolean).join(" ")} · ${s.name}` : s.name;
}
/** How a page appears elsewhere: what the artist set, or else what the page itself says. */
export function appearsOf(c: Ctx, p: SitePage | null): { title: string; description: string; share: W | null; own: boolean } {
  const why = c.locked?.(p);
  if (why === "soon") return { title: c.site.name, description: c.site.door.note, share: null, own: false };
  if (why === "word") return { title: titleText(c.site, p), description: "", share: null, own: false };
  const set = p ? p.appears : { title: "", description: "", share: c.site.appears.share };
  const fromPage = p ? ("note" in p ? p.note : "synopsis" in p ? p.synopsis : "summary" in p ? p.summary : p.kind === "writing" ? (p.paras[0] ?? "").split("\n").slice(0, 2).join(" ") : (p.paras?.[0] ?? "")) : c.site.front.note;
  const description = (set.description || fromPage || c.site.appears.description || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const shareId = (p ? p.appears.share : null) ?? (p ? coverOf(c, p)?.asset : null) ?? c.site.appears.share ?? workPages(c.site).map((x) => coverOf(c, x)).find(Boolean)?.asset ?? null;
  return { title: set.title || titleText(c.site, p), description, share: shareId && c.site.library[shareId] ? work(c, shareId) : null, own: !!(p ? p.appears.share : c.site.appears.share) };
}
