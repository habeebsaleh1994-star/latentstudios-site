/*
 * The whole site, drawn from the site document. Every page kind and every arrangement lives here,
 * so a site can mix them: a story held still, another as a book, a film, a poem, a project.
 *
 * Rendering returns html strings. In edit mode the same functions mark words as editable
 * (data-ed names the field) and add the editor's quiet marks; the page itself never changes shape.
 */
import type { SiteDocument, SitePage, StoryPage, Work, Piece } from "../studio/site";
import { ratioNumber } from "./util";
import { house } from "./houses";

export type Ctx = {
  site: SiteDocument;
  editing: boolean;
  /** Address of a page ("" is the front) as a link the current runtime understands. */
  href: (pageId: string) => string;
  /** Where an asset's file is, for the current runtime (dev server, stored upload, published files). */
  src: (asset: string) => string;
};
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
function img(_c: Ctx, w: W, lazy = true, extra = "") {
  return `<img src="${esc(w.src)}" width="${w.w}" height="${w.h}" alt="${esc(w.alt || w.title)}"${lazy ? ' loading="lazy"' : ""}${extra} style="--r:${w.r.toFixed(4)}">`;
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
  for (const p of c.site.pages) if ((p.kind === "about" || p.kind === "contact") && p.inNav) links.push([p.id, p.title]);
  return links.map(([id, t]) => `<a href="${c.href(id)}"${on === id ? ' aria-current="page"' : ""}>${esc(t)}</a>`).join("");
}
function bar(c: Ctx, on: string) {
  const logo = c.site.mark.logo && c.site.library[c.site.mark.logo] ? work(c, c.site.mark.logo) : null;
  const name = logo ? `<img class="logo" src="${esc(logo.src)}" alt="${esc(c.site.name)}" width="${logo.w}" height="${logo.h}" style="--r:${logo.r.toFixed(4)}">` : esc(c.site.name);
  return `<header class="bar"><a class="name${logo ? " has-logo" : ""}" href="${c.href("")}">${name}</a><nav aria-label="Primary">${navLinks(c, on)}</nav></header>`;
}
/** The foot of every page. It carries the menu too, for sites whose header shows only the name. */
function foot(c: Ctx, on: string) {
  return `<footer class="foot site-foot"><span class="foot-name">${esc(c.site.name)}</span><nav class="foot-nav" aria-label="Pages">${navLinks(c, on)}</nav><span class="label foot-line">${ed(c, "site.contact", c.site.contact, "span", "", "A line at the foot of every page")}</span><a class="mark" href="${c.href("")}" aria-label="Made with Latent Wall">l.</a></footer>`;
}
function next(c: Ctx, p: SitePage) {
  const list = shown(c), i = list.findIndex((x) => x.id === p.id);
  const n = list.length > 1 ? list[(i + 1) % list.length] : null;
  return n ? { page: n, html: `<a class="onward" href="${c.href(n.id)}"><span class="label">Next</span><span class="big">${plainTitle(n.title, n.titleEm)}</span></a>` } : { page: null, html: "" };
}

/* ------------------------------------------------------------------ covers: how a page shows on the front */

function coverOf(c: Ctx, p: SitePage): W | null {
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
const firstLines = (p: SitePage) => (p.kind === "writing" ? (p.paras[0] ?? "").split("\n").slice(0, 4).join("\n") : "");

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
function front(c: Ctx) {
  const list = shown(c);
  let body = "";
  if (!list.length) body = `<div class="empty">${c.editing ? "No work yet. Add a story, a film, some writing or a project from Edit." : ""}</div>`;
  else if (c.site.front.form === "walk") return frontWalk(c, list);
  else if (c.site.front.form === "list") {
    body = `<div class="f-list"><ol${c.site.house === "monograph" ? ' aria-label="Contents"' : ""}>${c.site.house === "monograph" ? '<li class="contents-h"><span class="label">Contents</span></li>' : ""}${list.map((p, i) => `<li class="${p.kind}${p.inNav ? "" : " off"}"><a href="${c.href(p.id)}" data-i="${i}"><span class="n">${n2(i + 1)}</span><h2>${plainTitle(p.title, p.titleEm)}</h2><span class="m">${esc(metaOf(p))}</span></a></li>`).join("")}</ol><div class="f-show" aria-hidden="true">${listShow(c, list[0])}</div></div>`;
  } else if (c.site.front.form === "sheet") {
    body = `<div class="f-sheet">${list.map((p) => { const w = coverOf(c, p); return `<a class="${p.kind}${p.inNav ? "" : " off"}" href="${c.href(p.id)}"><span class="fr">${w ? img(c, w) : `<span class="lines">${esc(firstLines(p))}</span>`}</span><h2>${plainTitle(p.title, p.titleEm)}</h2><span class="label">${esc(metaOf(p))}</span></a>`; }).join("")}</div>`;
  } else {
    body = `<div class="f-covers">${list.map((p, i) => { const w = coverOf(c, p); return `<a class="cover ${p.kind}${p.inNav ? "" : " off"}" href="${c.href(p.id)}" style="--r:${w ? w.r.toFixed(4) : 1.5}">${w ? img(c, w, i > 0) : `<span class="lines">${esc(firstLines(p))}</span>`}<span class="under"><h2>${plainTitle(p.title, p.titleEm)}</h2><span class="label">${esc(metaOf(p))}</span></span></a>`; }).join("")}</div>`;
  }
  return `<main class="v-front">${frontCard(c)}${body}</main>`;
}
/** Passage's front page: the work itself hung along one wall, each story's cover a door into it. */
function frontWalk(c: Ctx, list: SitePage[]) {
  const f = c.site.front;
  let h = `<section class="wall-text title"><span class="label">${ed(c, "front.kicker", f.kicker, "span", "", "Above the title")}</span><h1>${titleOf(c, "front", f.title, f.titleEm)}</h1>${ed(c, "front.note", f.note, "p", "", "A line or two to introduce the site")}</section>`;
  list.forEach((p, i) => {
    const w = coverOf(c, p);
    h += w ? `<a class="hang door${w.r < 1 ? " tall" : ""}" href="${c.href(p.id)}" style="--r:${w.r.toFixed(4)}" data-n="${n2(i + 1)}">${img(c, w, i > 1)}<span class="cap"><span class="n">${n2(i + 1)}</span><span>${esc([p.title, p.titleEm].filter(Boolean).join(" "))}</span><span class="d">${esc(metaOf(p))}</span></span></a>`
      : `<a class="wall-text say door" href="${c.href(p.id)}" data-n="${n2(i + 1)}"><span class="label">${esc(metaOf(p))}</span><p>${esc([p.title, p.titleEm].filter(Boolean).join(" "))}</p></a>`;
  });
  return `<main class="v-passage v-front-walk"><div class="walk" tabindex="0" aria-label="The work, hung in order. Scroll or use the arrow keys to walk along it.">${h}</div><footer class="rail"><span class="label">${esc(c.site.name)}</span><div class="line"><i></i></div><span class="label at"></span></footer></main>`;
}

export function listShow(c: Ctx, p: SitePage | undefined) {
  if (!p) return "";
  const w = coverOf(c, p);
  return (w ? img(c, w, false) : `<span class="lines">${esc(firstLines(p))}</span>`) + `<p class="cap"><span class="n">${esc(metaOf(p))}</span></p>`;
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
  const fig = (w: W, lazy: boolean) => `<figure style="--r:${w.r.toFixed(4)}"><div class="frame">${img(c, w, lazy)}${mark(c, p, w)}</div><figcaption>${cap(c, w)}</figcaption></figure>`;
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
  const plate = (w: W, extra = "") => `<figure><div class="in">${img(c, w, false)}${mark(c, p, w)}${cap(c, w)}${extra}</div></figure>`;
  const bare = (w: W) => `<figure><div class="in">${img(c, w, false)}${mark(c, p, w)}</div></figure>`;
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
  const hang = (w: W, cls = "", aside = "") => `<figure class="hang${w.r < 1 ? " tall" : ""}${cls}" style="--r:${w.r.toFixed(4)}" data-n="${w.n}">${aside}${img(c, w)}${mark(c, p, w)}<figcaption>${cap(c, w)}</figcaption></figure>`;
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
    const figs = ws.map((w) => { n++; const s = cmOf(w); return `<figure class="art" style="--cw:${s.w}" data-view="${n - 1}"><div class="frame">${img(c, w)}${mark(c, p, w)}</div><span class="no">${n}</span><span class="cap-m">${esc(w.title)}, ${cmText(s.w)} × ${cmText(s.h)} cm</span></figure>`; }).join("");
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
    for (const w of g.works) { list.push(`<div class="slide"><figure><div class="frame">${img(c, w, false)}${mark(c, p, w)}</div><figcaption>${cap(c, w)}</figcaption></figure>${g.type === "note" ? noteText(c, p, g, "p", "label") : ""}</div>`); thumbs.push(`<img src="${esc(w.src)}" alt="" loading="lazy">`); }
  }
  return { list, thumbs };
}
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
    `<div class="cols"><div><div class="col-h"><span>Process</span><span>${proc.length} steps</span></div><div class="steps">${proc.map((a, i) => fig(a, i, true)).join("")}</div></div><div class="col-out"><div class="col-h"><span>Outcome</span><span>${out.length}</span></div><div class="outcome">${out[0] ? fig(out[0], 0, false) : ""}</div></div></div>` +
    `${out.length > 1 ? `<div class="more">${out.slice(1).map((a, i) => fig(a, i + 1, false)).join("")}</div>` : ""}${compare}</article>${next(c, p).html}</main>`;
}

function words(c: Ctx, p: Extract<SitePage, { kind: "about" | "contact" }>) {
  const paras = p.paras.map((t, i) => ed(c, `page:${p.id}.para.${i}`, t, "p", "", "A paragraph")).join("");
  const prin = p.kind === "about" && p.principles.length ? `<ol class="principles">${p.principles.map((t, i) => `<li>${ed(c, `page:${p.id}.principle.${i}`, t, "span", "", "A principle")}</li>`).join("")}</ol>` : "";
  return `<main class="v-words"><section class="words"><div><h1>${ed(c, `page:${p.id}.title`, p.title, "span", "", "Title")}</h1></div><div class="body">${paras}</div></section>${prin}</main>`;
}

/* ------------------------------------------------------------------ one page */

export type View = "front" | "held" | "book" | "passage" | "contact" | "wall" | "slides" | "writing" | "film" | "project" | "words";

export function viewOf(p: SitePage | null, s?: SiteDocument): View {
  if (!p) return s?.front.form === "walk" ? "passage" : "front";
  if (p.kind === "story") return p.arrangement;
  if (p.kind === "about" || p.kind === "contact") return "words";
  return p.kind;
}

export function page(c: Ctx, p: SitePage | null): string {
  const on = !p || workPages(c.site).some((x) => x.id === p.id) ? "" : p.id;
  let main: string;
  if (!p) main = front(c);
  else if (p.kind === "story") main = { held, book, passage, contact, wall, slides }[p.arrangement](c, p);
  else if (p.kind === "writing") main = writing(c, p);
  else if (p.kind === "film") main = film(c, p);
  else if (p.kind === "project") main = project(c, p);
  else main = words(c, p);
  const v = viewOf(p, c.site);
  return bar(c, on) + main + (v === "book" || v === "passage" ? "" : foot(c, on));
}

export function titleText(s: SiteDocument, p: SitePage | null) {
  return p ? `${[p.title, p.titleEm].filter(Boolean).join(" ")} · ${s.name}` : s.name;
}
/** How a page appears elsewhere: what the artist set, or else what the page itself says. */
export function appearsOf(c: Ctx, p: SitePage | null): { title: string; description: string; share: W | null; own: boolean } {
  const set = p ? p.appears : { title: "", description: "", share: c.site.appears.share };
  const fromPage = p ? ("note" in p ? p.note : "synopsis" in p ? p.synopsis : "summary" in p ? p.summary : p.kind === "writing" ? (p.paras[0] ?? "").split("\n").slice(0, 2).join(" ") : (p.paras?.[0] ?? "")) : c.site.front.note;
  const description = (set.description || fromPage || c.site.appears.description || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const shareId = (p ? p.appears.share : null) ?? (p ? coverOf(c, p)?.asset : null) ?? c.site.appears.share ?? workPages(c.site).map((x) => coverOf(c, x)).find(Boolean)?.asset ?? null;
  return { title: set.title || titleText(c.site, p), description, share: shareId && c.site.library[shareId] ? work(c, shareId) : null, own: !!(p ? p.appears.share : c.site.appears.share) };
}
