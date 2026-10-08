/*
 * Every change the artist can make, as a pure function: site in, new site out. The editor only
 * calls these; history is a list of sites; tests cover each one. Nothing here touches the screen.
 */
import { siteSchema, workSchema, SITE_VERSION, type SiteDocument, type SitePage, type StoryPage, type Piece, type ArrangementId } from "../studio/site";
import { themeSchema, type Theme } from "../studio/site";
import { house, houseTheme, allows } from "./houses";

type S = SiteDocument;
const clone = (s: S): S => structuredClone(s);
const done = (s: S): S => siteSchema.parse(s);
const find = (s: S, id: string) => { const p = s.pages.find((x) => x.id === id); if (!p) throw new Error(`No page "${id}".`); return p; };
const story = (s: S, id: string) => { const p = find(s, id); if (p.kind !== "story") throw new Error(`"${id}" is not a story.`); return p; };

export type PageKind = SitePage["kind"];
export const KIND_NAMES: Record<PageKind, string> = { story: "Story", writing: "Writing", film: "Film", project: "Project", about: "About", contact: "Contact" };

/** An address made from the title, unique within the site. */
export function slug(s: S, title: string, except?: string) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "page";
  let id = base, n = 2;
  while (s.pages.some((p) => p.id === id && p.id !== except)) id = `${base}-${n++}`;
  return id;
}

/* ------------------------------------------------------------------ a new site */

/** An artist's new site: their name, the template they chose, About and Contact ready, and nothing else. */
export function blankSite(name: string, houseId: S["house"], title = ""): S {
  const h = house(houseId), words = title.trim().split(/\s+/).filter(Boolean);
  const em = words.length > 1 ? words.pop()! : "";
  return siteSchema.parse({
    version: SITE_VERSION, house: h.id, name: name.trim() || "Your name", contact: "", email: "",
    front: { form: h.fronts[0], kicker: "", title: words.join(" "), titleEm: em, note: "" },
    theme: themeSchema.parse(houseTheme(h)), library: {},
    pages: [{ id: "about", kind: "about", title: "About", inNav: true, paras: [""], principles: [] }, { id: "contact", kind: "contact", title: "Contact", inNav: true, paras: [""] }],
  });
}

/* ------------------------------------------------------------------ words */

/** Set the word a `data-ed` field names. Fields: site.x, front.x, page:ID.x (para.N, principle.N, credits, facts), piece:ID:K.x, work:ASSET.x */
export function setField(site: S, field: string, value: string): S {
  const s = clone(site), v = value.replace(/\s+$/, "");
  let m: RegExpMatchArray | null;
  if ((m = field.match(/^site\.(name|contact)$/))) s[m[1] as "name" | "contact"] = v;
  else if ((m = field.match(/^front\.(kicker|title|titleEm|note)$/))) s.front[m[1] as "title"] = v;
  else if ((m = field.match(/^work:(.+)\.(title|date|caption|alt)$/))) { const w = s.library[m[1]]; if (!w) throw new Error(`No work ${m[1]}.`); w[m[2] as "title"] = v; }
  else if ((m = field.match(/^piece:([^:]+):(\d+)\.(label|text|note)$/))) {
    const p = story(s, m[1]), x = p.pieces[+m[2]] as Record<string, unknown> | undefined;
    if (!x || !(m[3] in x)) throw new Error(`No ${m[3]} at ${field}.`);
    x[m[3]] = v;
  } else if ((m = field.match(/^page:([^.]+)\.(.+)$/))) {
    const p = find(s, m[1]) as Record<string, unknown> & SitePage, f = m[2];
    let k: RegExpMatchArray | null;
    if ((k = f.match(/^(para|principle)\.(\d+)$/))) { const list = (k[1] === "para" ? p.paras : (p as { principles: string[] }).principles) as string[] | undefined; if (!list) throw new Error(`No ${k[1]} on ${p.id}.`); list[+k[2]] = v; }
    else if (f === "credits" || f === "facts") p[f] = v.split("\n").map((t) => t.trim()).filter(Boolean);
    else if (f === "title" && p.kind !== "about" && p.kind !== "contact" && !v) p.title = "Untitled";
    else if (f in p && typeof p[f] === "string") p[f] = v;
    else throw new Error(`No field ${f} on ${p.id}.`);
  } else throw new Error(`Unknown field ${field}.`);
  return done(s);
}

/* ------------------------------------------------------------------ pages */

export function addPage(site: S, kind: PageKind, title?: string): { site: S; id: string } {
  const s = clone(site), t = title ?? ({ story: "New story", writing: "A new piece", film: "A new film", project: "A new project", about: "About", contact: "Contact" } as const)[kind];
  const id = slug(s, t), base = { id, title: t, titleEm: "", inNav: true };
  const page: SitePage = kind === "story" ? { ...base, kind, kicker: "", note: "", arrangement: house(s.house).arrangements[0], pieces: [] }
    : kind === "writing" ? { ...base, kind, form: "Poem", place: "", year: String(new Date().getFullYear()), paras: [""], margin: "", image: null }
    : kind === "film" ? { ...base, kind, form: "Short film", year: String(new Date().getFullYear()), runtime: "", ratio: "16:9", synopsis: "", poster: null, video: null, link: "", stills: [], credits: [] }
    : kind === "project" ? { ...base, kind, discipline: "", client: "", year: String(new Date().getFullYear()), summary: "", outcome: [], process: [], compare: false, facts: [] }
    : kind === "about" ? { ...base, kind, paras: [""], principles: [] } : { ...base, kind, paras: [""] };
  // work pages go after the last work page, words pages at the end
  const isWork = (p: SitePage) => p.kind === "story" || p.kind === "writing" || p.kind === "film" || p.kind === "project";
  const lastWork = s.pages.map(isWork).lastIndexOf(true);
  s.pages.splice(isWork(page) ? lastWork + 1 : s.pages.length, 0, page);
  return { site: done(s), id };
}
export function movePage(site: S, id: string, dir: -1 | 1): S {
  const s = clone(site), i = s.pages.findIndex((p) => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= s.pages.length) return site;
  [s.pages[i], s.pages[j]] = [s.pages[j], s.pages[i]]; return done(s);
}
export function toggleNav(site: S, id: string): S { const s = clone(site), p = find(s, id); p.inNav = !p.inNav; return done(s); }
export function removePage(site: S, id: string): S { const s = clone(site); s.pages = s.pages.filter((p) => p.id !== id); return done(s); }
/** A page's address follows its title until it is set by hand; keeps links working inside the site. */
export function renamePage(site: S, id: string, to: string): { site: S; id: string } {
  const s = clone(site), p = find(s, id), nid = slug(s, to, id);
  p.id = nid; return { site: done(s), id: nid };
}
export function setFront(site: S, form: S["front"]["form"]): S {
  if (!house(site.house).fronts.includes(form)) throw new Error("This template does not offer that front page.");
  const s = clone(site); s.front.form = form; return done(s);
}
export function setArrangement(site: S, id: string, a: ArrangementId): S {
  if (!house(site.house).arrangements.includes(a)) throw new Error("This template does not offer that arrangement.");
  const s = clone(site); story(s, id).arrangement = a; return done(s);
}
/**
 * Choose a template: it decides its skeleton, look, type and front page, and every story takes the
 * template's own arrangement. Content is never touched.
 */
export function applyHouse(site: S, id: S["house"]): { site: S; rearranged: string[] } {
  const h = house(id), s = clone(site), rearranged: string[] = [];
  s.house = h.id; s.theme = themeSchema.parse({ ...s.theme, ...houseTheme(h) }); s.front.form = h.fronts[0];
  // the template decides: every story takes its own arrangement (the artist can then choose among those it offers)
  for (const p of s.pages) if (p.kind === "story" && p.arrangement !== h.arrangements[0]) { p.arrangement = h.arrangements[0]; rearranged.push(p.id); }
  return { site: done(s), rearranged };
}
/** Bring a site within its template: any choice the template does not offer falls back to the template's own. Used when a site is opened. */
export function conform(site: S): S {
  const h = house(site.house), base = houseTheme(h), s = clone(site);
  for (const k of ["look", "typeface", "header", "opening", "title", "captions", "footer", "scale"] as const) if (!allows(h, k, s.theme[k])) (s.theme as Record<string, unknown>)[k] = base[k];
  if (!h.fronts.includes(s.front.form)) s.front.form = h.fronts[0];
  for (const p of s.pages) if (p.kind === "story" && !h.arrangements.includes(p.arrangement)) p.arrangement = h.arrangements[0];
  return done(s);
}
/** A theme change, refused if it reaches outside what the template offers. */
export function setTheme(site: S, patch: Partial<Theme>): S {
  const h = house(site.house);
  for (const [k, v] of Object.entries(patch)) if (!allows(h, k, v)) throw new Error("This template does not offer that choice.");
  const s = clone(site); s.theme = themeSchema.parse({ ...s.theme, ...patch }); return done(s);
}

/* ------------------------------------------------------------------ the library */

export function addToLibrary(site: S, asset: string, w: { w: number; h: number; title: string; kind?: "image" | "video" }): S {
  const s = clone(site);
  s.library[asset] = workSchema.parse({ kind: w.kind ?? "image", w: w.w, h: w.h, title: w.title, alt: w.title, date: today() });
  return done(s);
}
/** Works no page uses; removed only when the artist asks, never as a side effect. */
export function unused(site: S): string[] {
  const used = new Set(site.pages.flatMap((p) => assetsOn(p)));
  return Object.keys(site.library).filter((a) => !used.has(a));
}
export function removeFromLibrary(site: S, asset: string): S {
  if (!unused(site).includes(asset)) throw new Error("This work is still on a page.");
  const s = clone(site); delete s.library[asset]; return done(s);
}
const assetsOn = (p: SitePage): string[] => p.kind === "story" ? p.pieces.flatMap((x) => (x.type === "work" ? [x.asset] : [])) : p.kind === "writing" ? (p.image ? [p.image.asset] : []) : p.kind === "film" ? [p.poster, p.video, ...p.stills.map((x) => x.asset)].filter((a): a is string => !!a) : p.kind === "project" ? [...p.outcome, ...p.process] : [];
export function today() { const d = new Date(); return `${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`; }

/* ------------------------------------------------------------------ a story's works */

/** A pair or a note that no longer has what it needs falls back to "alone", so nothing is left half-arranged. */
function tidy(p: StoryPage) {
  // keep the artist's intent where any arrangement can still show it (a wall hangs across a pause);
  // only a "with the next" with no work after it at all is let go
  p.pieces.forEach((x, i) => {
    if (x.type === "work" && x.arrange === "with-next" && !p.pieces.slice(i + 1).some((y) => y.type === "work")) x.arrange = "alone";
  });
}
export function addWorks(site: S, id: string, after: number, assets: string[]): S {
  const s = clone(site), p = story(s, id);
  for (const a of assets) if (!s.library[a]) throw new Error(`No work ${a} in the library.`);
  p.pieces.splice(Math.min(after + 1, p.pieces.length), 0, ...assets.map((asset): Piece => ({ type: "work", asset, arrange: "alone", note: "", full: false })));
  tidy(p); return done(s);
}
export function movePiece(site: S, id: string, k: number, dir: -1 | 1): S {
  const s = clone(site), p = story(s, id), j = k + dir;
  if (k < 0 || j < 0 || j >= p.pieces.length) return site;
  [p.pieces[k], p.pieces[j]] = [p.pieces[j], p.pieces[k]]; tidy(p); return done(s);
}
export function removePiece(site: S, id: string, k: number): S {
  const s = clone(site), p = story(s, id);
  if (!p.pieces[k]) return site;
  p.pieces.splice(k, 1); tidy(p); return done(s);
}
export function addPause(site: S, id: string, after: number): S {
  const s = clone(site), p = story(s, id);
  p.pieces.splice(after + 1, 0, { type: "pause", label: "", text: "" });
  tidy(p); return done(s);
}

export type ArrangeKey = "alone" | "with-next" | "with-prev" | "margin-note" | "full";
type Opt = { key: ArrangeKey; title: string; note: string; current: boolean };
/**
 * The ways a work can sit, given the story's arrangement, the work's shape and its neighbours.
 * Only what will visibly happen is offered: a choice that changes nothing on the page is never shown.
 *   held, book   on its own, a pair of landscapes, a note beside a portrait, full
 *   passage      on its own, hung close to the next, a note beside it
 *   wall         hang with the next on one wall, or end the wall here
 *   slides       on its own, or with a line under it
 *   contact      every frame sits in an equal cell: nothing to choose
 */
export function arrangeOptions(site: S, id: string, k: number): Opt[] {
  const p = story(site, id), x = p.pieces[k]; if (!x || x.type !== "work") return [];
  const lib = site.library, isWork = (a?: Piece): a is Extract<Piece, { type: "work" }> => !!a && a.type === "work";
  const landscape = (a?: Piece) => isWork(a) && lib[a.asset].w >= lib[a.asset].h;
  const prev = p.pieces[k - 1], nx = p.pieces[k + 1], portrait = lib[x.asset].w < lib[x.asset].h, a = p.arrangement;
  if (a === "contact") return [];
  if (a === "wall") {
    // a wall ignores pauses: the next work is the next work, wherever it is
    const after = p.pieces.slice(k + 1).some(isWork), hangs = x.arrange === "with-next" && after;
    if (!after) return [];
    return [
      { key: "with-next", title: "Hang with the next one", note: "On the same wall, on one eye line", current: hangs },
      { key: "alone", title: "End the wall here", note: "The next work starts a new wall", current: !hangs },
    ];
  }
  // what the reader sees now, not what is stored: a stored choice this arrangement cannot show is not "current".
  // Pairs are found the way the page finds them: walking the story, two at a time.
  const starts = new Set<number>();
  for (let i = 0; i < p.pieces.length; i++) { const y = p.pieces[i]; if (isWork(y) && y.arrange === "with-next" && landscape(y) && landscape(p.pieces[i + 1])) { starts.add(i); i++; } }
  const paired = starts.has(k), pairedPrev = starts.has(k - 1);
  const noteShows = x.arrange === "margin-note" && (portrait || a === "passage" || a === "slides");
  const fullShows = x.full && (a === "held" || a === "book") && !paired && !pairedPrev;
  if (a === "slides") {
    return [
      { key: "alone", title: "On its own", note: "The work and its caption", current: !noteShows },
      { key: "margin-note", title: "With a line under it", note: "A few words beneath the caption", current: noteShows },
    ];
  }
  const prevTaken = starts.has(k - 2);
  const pairName = a === "passage" ? "Close to the next one" : "With the next one", pairNote = a === "passage" ? "Hung near it, as a pair" : a === "book" ? "On facing pages" : "Side by side";
  const o: Opt[] = [{ key: "alone", title: "On its own", note: a === "passage" ? "With room around it on the wall" : "Held large, with its caption", current: !paired && !pairedPrev && !noteShows && !fullShows }];
  if (landscape(x) && landscape(nx) && !pairedPrev && !starts.has(k + 1)) o.push({ key: "with-next", title: pairName, note: pairNote, current: paired });
  if (landscape(x) && landscape(prev) && !paired && !prevTaken) o.push({ key: "with-prev", title: a === "passage" ? "Close to the one before" : "With the one before", note: pairNote, current: pairedPrev });
  if (portrait || a === "passage") o.push({ key: "margin-note", title: "With a note beside it", note: "A line in the margin", current: noteShows });
  if (a !== "passage" && !paired && !pairedPrev) o.push({ key: "full", title: a === "book" ? "Across both pages" : "Full", note: a === "book" ? "A spread of its own" : "As large as the page allows", current: fullShows });
  return o;
}
export function arrange(site: S, id: string, k: number, key: ArrangeKey): S {
  const s = clone(site), p = story(s, id), x = p.pieces[k], prev = p.pieces[k - 1];
  if (!x || x.type !== "work") return site;
  const unpairPrev = () => { if (prev && prev.type === "work" && prev.arrange === "with-next") prev.arrange = "alone"; };
  if (key === "with-prev") { if (prev?.type === "work") { prev.arrange = "with-next"; x.full = false; prev.full = false; } x.arrange = x.arrange === "with-next" ? "alone" : x.arrange; }
  else if (key === "full") { unpairPrev(); x.full = !x.full; x.arrange = "alone"; }
  else { unpairPrev(); x.arrange = key; x.full = false; if (key === "with-next") { const n = p.pieces[k + 1]; if (n?.type === "work") n.full = false; } }
  tidy(p); return done(s);
}
/** Move a work to another story (or a new one); the work keeps its words, the story it leaves closes the gap. */
export function moveTo(site: S, from: string, k: number, to: string | "new"): { site: S; to: string } {
  let s = clone(site);
  const p = story(s, from), x = p.pieces[k]; if (!x || x.type !== "work") return { site, to: from };
  let dest = to;
  if (to === "new") { const r = addPage(s, "story"); s = clone(r.site); dest = r.id; }
  const src = story(s, from); src.pieces.splice(k, 1); tidy(src);
  story(s, dest).pieces.push({ type: "work", asset: x.asset, arrange: "alone", note: "", full: false });
  return { site: done(s), to: dest };
}

/* ------------------------------------------------------------------ films, projects, writing */

type ListName = "stills" | "outcome" | "process";
export function addToList(site: S, id: string, list: ListName, assets: string[]): S {
  const s = clone(site), p = find(s, id);
  if (list === "stills" && p.kind === "film") p.stills.push(...assets.map((asset) => ({ asset, caption: "" })));
  else if ((list === "outcome" || list === "process") && p.kind === "project") p[list].push(...assets);
  else throw new Error(`${id} has no ${list}.`);
  return done(s);
}
export function moveInList(site: S, id: string, list: ListName, i: number, dir: -1 | 1): S {
  const s = clone(site), p = find(s, id) as Record<string, unknown>, arr = p[list] as unknown[] | undefined, j = i + dir;
  if (!arr || i < 0 || j < 0 || j >= arr.length) return site;
  [arr[i], arr[j]] = [arr[j], arr[i]]; return done(s);
}
export function removeFromList(site: S, id: string, list: ListName, i: number): S {
  const s = clone(site), p = find(s, id) as Record<string, unknown>, arr = p[list] as unknown[] | undefined;
  if (!arr || !arr[i]) return site;
  arr.splice(i, 1);
  if (list !== "stills") { const pr = p as { compare: boolean; outcome: string[]; process: string[] }; if (!pr.outcome.length || !pr.process.length) pr.compare = false; }
  return done(s);
}
export function setFilm(site: S, id: string, patch: { poster?: string | null; video?: string | null; ratio?: string; link?: string }): S {
  const s = clone(site), p = find(s, id); if (p.kind !== "film") throw new Error(`${id} is not a film.`); Object.assign(p, patch); return done(s);
}
export function setCompare(site: S, id: string, on: boolean): S {
  const s = clone(site), p = find(s, id); if (p.kind !== "project") throw new Error(`${id} is not a project.`); p.compare = on && !!p.outcome.length && !!p.process.length; return done(s);
}
export function setWritingImage(site: S, id: string, image: { asset: string; at: "cover" | number } | null): S {
  const s = clone(site), p = find(s, id); if (p.kind !== "writing") throw new Error(`${id} is not writing.`); p.image = image; return done(s);
}
export function addPara(site: S, id: string, field: "paras" | "principles" = "paras"): S {
  const s = clone(site), p = find(s, id) as Record<string, unknown>, arr = p[field] as string[] | undefined;
  if (!arr) throw new Error(`${id} has no ${field}.`); arr.push(""); return done(s);
}
export function removePara(site: S, id: string, i: number, field: "paras" | "principles" = "paras"): S {
  const s = clone(site), p = find(s, id) as Record<string, unknown>, arr = p[field] as string[] | undefined;
  if (!arr || i < 0 || i >= arr.length) return site; arr.splice(i, 1); return done(s);
}
