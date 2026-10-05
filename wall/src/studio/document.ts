/*
 * Studio document, version 14.
 *
 * The artist states content and intent; the room derives the layout. A block says
 * "alone", "with the next one" or "with a margin note"; it never carries gaps,
 * ratios or coordinates. Look is a small set of designed choices (theme), not numbers.
 *
 * Pages and blocks (asset, caption, alt text, focal point) are kept from version 13,
 * so the media store, undo history and publishing keep working unchanged.
 */
import { z } from "zod";

export const STUDIO_VERSION = 14 as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const short = z.string().max(500);

export const roomIds = ["folio", "index", "salon", "reel", "atelier", "passage", "lantern"] as const;
export type RoomId = (typeof roomIds)[number];

export const lookIds = ["quiet", "swiss", "darkroom", "zine", "gallery", "soft", "toned", "cyanotype", "graphite", "etching", "monotype", "albumen", "proof", "paperback", "plaster", "cinema", "blueprint"] as const;
export const themeSchema = z
  .object({
    look: z.enum(lookIds).default("quiet"),
    /** Choices a template offers inside its own foundation (caption position, wall colour, and so on). Unknown ones are ignored by the template. */
    options: z.record(z.string().max(32), z.string().max(32)).default({}),
    palette: z.enum(["silk", "bone", "fog", "clay", "night"]).default("silk"),
    mode: z.enum(["light", "dark", "system"]).default("system"),
    /** The artist's accent colour, or null to use the look's own. */
    accent: hex.nullable().default(null),
    type: z.enum(["silk", "press", "atelier", "archive"]).default("silk"),
    mount: z.enum(["bare", "line", "matte"]).default("bare"),
    space: z.enum(["airy", "standard", "close"]).default("standard"),
    motion: z.enum(["slow", "still"]).default("slow"),
    read: z.enum(["small", "standard", "large"]).default("standard"),
  })
  .strict();
export type Theme = z.infer<typeof themeSchema>;

/** How a work sits among its neighbours. Intent only. */
export const arrangeSchema = z.enum(["alone", "with-next", "margin-note"]);
export type Arrange = z.infer<typeof arrangeSchema>;

export const blockSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["image", "video", "text"]),
    assetId: z.string(),
    title: short.default(""),
    date: z.string().max(40).default(""),
    caption: short.default(""),
    alt: short.default(""),
    focal: z
      .object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })
      .default({ x: 50, y: 50 }),
    text: z.string().max(30000).default(""),
    role: z.enum(["body", "pause", "process"]).default("body"),
    arrange: arrangeSchema.default("alone"),
    note: z.string().max(500).default(""),
    /** The real size of the work in centimetres, when the artist has given it. */
    size: z.object({ w: z.number().min(1).max(2000), h: z.number().min(1).max(2000) }).nullable().default(null),
  })
  .strict();
export type StudioBlock = z.infer<typeof blockSchema>;

export const pageSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["home", "project", "writing", "about"]),
    title: short,
    label: short,
    subtitle: z.string().max(5000),
    meta: short,
    inNav: z.boolean(),
    blocks: z.array(blockSchema).max(100),
  })
  .strict();
export type StudioPage = z.infer<typeof pageSchema>;

export const studioSchema = z
  .object({
    version: z.literal(STUDIO_VERSION),
    room: z.enum(roomIds).default("folio"),
    name: short,
    tagline: short,
    email: z.union([z.literal(""), z.email()]),
    theme: themeSchema,
    pages: z.array(pageSchema).min(1).max(50),
  })
  .strict();
export type StudioDocument = z.infer<typeof studioSchema>;


/* ------------------------------------------------------------------ rooms */

export type RoomAsset = { src: string; w: number; h: number };
export type FolioWork = { assetId: string; src: string; w: number; h: number; title: string; date: string; alt: string };
export type FolioBlock =
  | { type: "single"; work: string }
  | { type: "pair"; works: [string, string] }
  | { type: "split"; work: string; note: string }
  | { type: "pause"; label: string; text: string };
export type FolioContent = {
  site: { name: string; kicker: string; title: string; titleEm: string; note: string; aboutTitle: string; about: string[]; contact: string };
  works: Record<string, FolioWork>;
  blocks: FolioBlock[];
};

/** Turn one page of a document into what the Folio room renders. Intent in, layout out. */
export function toFolioContent(doc: StudioDocument, pageId: string, resolve: (assetId: string) => RoomAsset): FolioContent {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`No page "${pageId}" in this document.`);
  const words = page.title.replace(/\s+/g, " ").trim().split(" ");
  const titleEm = words.length > 1 ? words[words.length - 1] : "";
  const title = words.length > 1 ? words.slice(0, -1).join(" ") : page.title;

  const works: Record<string, FolioWork> = {};
  const blocks: FolioBlock[] = [];
  const bs = page.blocks;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (b.type === "text") {
      if (b.text.trim()) blocks.push({ type: "pause", label: b.title || page.label, text: b.text.trim() });
      continue;
    }
    const a = resolve(b.assetId);
    works[b.id] = { assetId: b.assetId, src: a.src, w: a.w, h: a.h, title: b.title || b.caption, date: b.date, alt: b.alt || b.title || b.caption };
    const portrait = a.h > a.w;
    const next = bs[i + 1];
    if (b.arrange === "with-next" && !portrait && next && next.type !== "text") {
      const na = resolve(next.assetId);
      if (na.h <= na.w) {
        works[next.id] = { assetId: next.assetId, src: na.src, w: na.w, h: na.h, title: next.title || next.caption, date: next.date, alt: next.alt || next.title || next.caption };
        blocks.push({ type: "pair", works: [b.id, next.id] });
        i++;
        continue;
      }
    }
    if (b.arrange === "margin-note" && portrait) blocks.push({ type: "split", work: b.id, note: b.note });
    else blocks.push({ type: "single", work: b.id });
  }
  const about = doc.pages.find((p) => p.kind === "about");
  return {
    site: {
      name: doc.name, kicker: page.meta || page.label, title, titleEm, note: page.subtitle,
      aboutTitle: about?.title ?? "About", about: (about?.blocks ?? []).filter((b) => b.type === "text" && b.text.trim()).map((b) => b.text), contact: doc.tagline,
    },
    works, blocks,
  };
}

/**
 * The inverse: write what the room shows back into the document. Fields the room does not
 * show (caption, focal point) are kept from the existing block when the work is already known.
 * Prose blocks come back as pauses, since that is how the room presents them.
 */
export function fromFolioContent(doc: StudioDocument, pageId: string, content: Pick<FolioContent, "site" | "works" | "blocks">): StudioDocument {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`No page "${pageId}" in this document.`);
  const known = new Map(page.blocks.map((b) => [b.id, b]));
  const media = (id: string, arrange: Arrange, note = ""): StudioBlock => {
    const w = content.works[id];
    if (!w) throw new Error(`Block refers to a work that is not in the content: ${id}`);
    const prev = known.get(id);
    return blockSchema.parse({ ...(prev ?? {}), id, type: prev?.type === "video" ? "video" : "image", assetId: w.assetId, title: w.title, date: w.date, alt: w.alt, arrange, note });
  };
  const blocks: StudioBlock[] = [];
  content.blocks.forEach((b, i) => {
    if (b.type === "single") blocks.push(media(b.work, "alone"));
    else if (b.type === "pair") { blocks.push(media(b.works[0], "with-next")); blocks.push(media(b.works[1], "alone")); }
    else if (b.type === "split") blocks.push(media(b.work, "margin-note", b.note));
    else blocks.push(blockSchema.parse({ id: `pause-${i}`, type: "text", assetId: "", role: "pause", title: b.label, text: b.text }));
  });
  const s = content.site;
  const next: StudioDocument = {
    ...doc,
    name: s.name,
    pages: doc.pages.map((p) => (p.id === pageId ? { ...p, title: [s.title, s.titleEm].filter(Boolean).join(" "), subtitle: s.note, meta: s.kicker, blocks } : p)),
  };
  return studioSchema.parse(next);
}

/* ------------------------------------------------------------------ Index */

export type IndexKind = "poem" | "essay" | "fragment";
export type IndexImage = { assetId: string; src: string; w: number; h: number; alt: string; caption: string; at: "cover" | number };
export type IndexPiece = { id: string; title: string; form: string; place: string; year: string; kind: IndexKind; paras: string[]; margin: string; image: IndexImage | null };
export type IndexContent = {
  site: { name: string; kicker: string; title: string; titleEm: string; note: string; aboutTitle: string; about: string[]; contact: string };
  pieces: IndexPiece[];
};

/** "What the | door keeps" splits where the bar is; otherwise the last word is the italic one. */
export function splitTitle(t: string): [string, string] {
  if (t.includes("|")) { const [a, ...b] = t.split("|"); return [a.trim(), b.join("|").trim()]; }
  const w = t.replace(/\s+/g, " ").trim().split(" ");
  return w.length > 1 ? [w.slice(0, -1).join(" "), w[w.length - 1]] : [t, ""];
}
const kindOf = (label: string): IndexKind => { const l = label.toLowerCase(); return l.includes("poem") ? "poem" : l.includes("essay") ? "essay" : "fragment"; };
const parseMeta = (meta: string) => { const m = meta.match(/^(.*?)[,\s·]*(\d{4})\s*$/); return m ? { place: m[1].trim(), year: m[2] } : { place: meta.trim(), year: "" }; };

/** Each writing page is one piece. Text blocks are its paragraphs (a poem is one block with line breaks); an image before the text is a cover, an image after paragraph n is set inside it. */
export function toIndexContent(doc: StudioDocument, resolve: (assetId: string) => RoomAsset): IndexContent {
  const home = doc.pages.find((p) => p.kind === "home");
  const about = doc.pages.find((p) => p.kind === "about");
  const [title, titleEm] = splitTitle(home?.title ?? doc.name);
  const pieces: IndexPiece[] = doc.pages.filter((p) => p.kind === "writing").map((p) => {
    const paras: string[] = []; let image: IndexImage | null = null; let margin = "";
    for (const b of p.blocks) {
      if (b.type === "text") { paras.push(b.text); if (b.note && !margin) margin = b.note; }
      else if (!image) { const a = resolve(b.assetId); image = { assetId: b.assetId, src: a.src, w: a.w, h: a.h, alt: b.alt || b.title, caption: b.title, at: paras.length === 0 ? "cover" : paras.length }; }
    }
    const { place, year } = parseMeta(p.meta);
    return { id: p.id, title: p.title, form: p.label, place, year, kind: kindOf(p.label), paras, margin, image };
  });
  return {
    site: { name: doc.name, kicker: home?.meta ?? "", title, titleEm, note: home?.subtitle ?? "", aboutTitle: about?.title ?? "About", about: (about?.blocks ?? []).filter((b) => b.type === "text" && b.text.trim()).map((b) => b.text), contact: doc.tagline },
    pieces,
  };
}

export function fromIndexContent(doc: StudioDocument, content: Pick<IndexContent, "site" | "pieces">): StudioDocument {
  const known = new Map(doc.pages.map((p) => [p.id, p]));
  const writing: StudioPage[] = content.pieces.map((pc) => {
    const prev = known.get(pc.id);
    const blocks: StudioBlock[] = [];
    const img = (): StudioBlock => blockSchema.parse({ id: `${pc.id}-img`, type: "image", assetId: pc.image!.assetId, title: pc.image!.caption, alt: pc.image!.alt });
    if (pc.image && pc.image.at === "cover") blocks.push(img());
    pc.paras.forEach((t, i) => {
      blocks.push(blockSchema.parse({ id: `${pc.id}-t${i}`, type: "text", assetId: "", text: t, note: i === 0 ? pc.margin : "" }));
      if (pc.image && pc.image.at === i + 1) blocks.push(img());
    });
    if (pc.image && typeof pc.image.at === "number" && pc.image.at > pc.paras.length) blocks.push(img());
    return pageSchema.parse({ id: pc.id, kind: "writing", title: pc.title, label: pc.form, subtitle: prev?.subtitle ?? "", meta: [pc.place, pc.year].filter(Boolean).join(", "), inNav: prev?.inNav ?? true, blocks });
  });
  const firstWriting = doc.pages.findIndex((p) => p.kind === "writing");
  const others = doc.pages.filter((p) => p.kind !== "writing").map((p) => {
    if (p.kind !== "home") return p;
    return { ...p, title: content.site.titleEm ? `${content.site.title} | ${content.site.titleEm}` : content.site.title, subtitle: content.site.note, meta: content.site.kicker };
  });
  const at = firstWriting < 0 ? others.length : doc.pages.slice(0, firstWriting).filter((p) => p.kind !== "writing").length;
  const pages = [...others.slice(0, at), ...writing, ...others.slice(at)];
  return studioSchema.parse({ ...doc, name: content.site.name, pages });
}

/* ------------------------------------------------------------------ Salon */

/** A work in Salon always has a size. When the artist has not given one, assume 60 cm on the long edge. */
export const DEFAULT_LONG_EDGE_CM = 60;
export type SalonWork = { assetId: string; src: string; w: number; h: number; title: string; date: string; medium: string; alt: string; cmW: number; cmH: number };
/** "with" hangs beside the next work on the same wall; "alone" ends the wall. */
export type SalonBlock = { type: "work"; work: string; hang: "with" | "alone" };
export type SalonContent = {
  site: { name: string; kicker: string; title: string; titleEm: string; note: string; aboutTitle: string; about: string[]; contact: string };
  works: Record<string, SalonWork>;
  blocks: SalonBlock[];
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export function toSalonContent(doc: StudioDocument, pageId: string, resolve: (assetId: string) => RoomAsset): SalonContent {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`No page "${pageId}" in this document.`);
  const about = doc.pages.find((p) => p.kind === "about");
  const [title, titleEm] = splitTitle(page.title);
  const works: Record<string, SalonWork> = {};
  const blocks: SalonBlock[] = [];
  const media = page.blocks.filter((b) => b.type !== "text");
  media.forEach((b, i) => {
    const a = resolve(b.assetId);
    const k = DEFAULT_LONG_EDGE_CM / Math.max(a.w, a.h);
    works[b.id] = { assetId: b.assetId, src: a.src, w: a.w, h: a.h, title: b.title, date: b.date, medium: b.caption, alt: b.alt || b.title, cmW: b.size?.w ?? round1(a.w * k), cmH: b.size?.h ?? round1(a.h * k) };
    blocks.push({ type: "work", work: b.id, hang: b.arrange === "with-next" && i < media.length - 1 ? "with" : "alone" });
  });
  return {
    site: { name: doc.name, kicker: page.meta || page.label, title, titleEm, note: page.subtitle, aboutTitle: about?.title ?? "About", about: (about?.blocks ?? []).filter((b) => b.type === "text" && b.text.trim()).map((b) => b.text), contact: doc.tagline },
    works, blocks,
  };
}

export function fromSalonContent(doc: StudioDocument, pageId: string, content: Pick<SalonContent, "site" | "works" | "blocks">): StudioDocument {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`No page "${pageId}" in this document.`);
  const known = new Map(page.blocks.map((b) => [b.id, b]));
  const blocks = content.blocks.map((b) => {
    const w = content.works[b.work];
    if (!w) throw new Error(`Block refers to a work that is not in the content: ${b.work}`);
    return blockSchema.parse({ ...(known.get(b.work) ?? {}), id: b.work, type: "image", assetId: w.assetId, title: w.title, date: w.date, caption: w.medium, alt: w.alt, size: { w: w.cmW, h: w.cmH }, arrange: b.hang === "with" ? "with-next" : "alone" });
  });
  const s = content.site;
  return studioSchema.parse({
    ...doc, name: s.name,
    pages: doc.pages.map((p) => (p.id === pageId ? { ...p, title: s.titleEm ? `${s.title} | ${s.titleEm}` : s.title, subtitle: s.note, meta: s.kicker, blocks } : p)),
  });
}

/* ------------------------------------------------------------------ Reel */

export type ReelStill = { assetId: string; src: string; w: number; h: number; alt: string; caption: string };
export type ReelFilm = {
  id: string; title: string; form: string; year: string; runtime: string; ratio: string; synopsis: string;
  credits: string[]; link: string;
  poster: ReelStill | null;
  video: { assetId: string; src: string } | null;
  stills: ReelStill[];
};
export type ReelContent = {
  site: { name: string; kicker: string; title: string; titleEm: string; note: string; aboutTitle: string; about: string[]; contact: string };
  films: ReelFilm[];
};

/** "2.39:1" or "16:9" or "1.85" as a width-to-height number; anything else is a 16:9 screen. */
export function ratioNumber(r: string): number {
  const m = r.trim().match(/^(\d+(?:\.\d+)?)\s*(?::|\/|x)\s*(\d+(?:\.\d+)?)$/) ?? r.trim().match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return 16 / 9;
  const n = m[2] ? parseFloat(m[1]) / parseFloat(m[2]) : parseFloat(m[1]);
  return n >= 0.5 && n <= 4 ? n : 16 / 9;
}
const parseFilmMeta = (meta: string) => {
  const parts = meta.split("·").map((p) => p.trim()).filter(Boolean);
  return { year: parts.find((p) => /^\d{4}$/.test(p)) ?? "", runtime: parts.find((p) => /\b(min|sec|s)\b/i.test(p) || /^\d+\s*['′]/.test(p)) ?? "", ratio: parts.find((p) => /:|\//.test(p) && !/min/i.test(p)) ?? "" };
};

/** Each project page is a film: the first image is the poster, later images are stills, a video block is the film (or just its link), text blocks are credits. */
export function toReelContent(doc: StudioDocument, resolve: (assetId: string) => RoomAsset): ReelContent {
  const home = doc.pages.find((p) => p.kind === "home");
  const about = doc.pages.find((p) => p.kind === "about");
  const [title, titleEm] = splitTitle(home?.title ?? doc.name);
  const still = (b: StudioBlock): ReelStill => { const a = resolve(b.assetId); return { assetId: b.assetId, src: a.src, w: a.w, h: a.h, alt: b.alt || b.title, caption: b.title }; };
  const films: ReelFilm[] = doc.pages.filter((p) => p.kind === "project").map((p) => {
    const f: ReelFilm = { id: p.id, title: p.title, form: p.label, ...parseFilmMeta(p.meta), synopsis: p.subtitle, credits: [], link: "", poster: null, video: null, stills: [] };
    for (const b of p.blocks) {
      if (b.type === "text") { if (b.text.trim()) f.credits.push(b.text); }
      else if (b.type === "video") { f.link = b.note; if (b.assetId) f.video = { assetId: b.assetId, src: resolve(b.assetId).src }; }
      else if (!f.poster) f.poster = still(b);
      else f.stills.push(still(b));
    }
    return f;
  });
  return {
    site: { name: doc.name, kicker: home?.meta ?? "", title, titleEm, note: home?.subtitle ?? "", aboutTitle: about?.title ?? "About", about: (about?.blocks ?? []).filter((b) => b.type === "text" && b.text.trim()).map((b) => b.text), contact: doc.tagline },
    films,
  };
}

export function fromReelContent(doc: StudioDocument, content: Pick<ReelContent, "site" | "films">): StudioDocument {
  const known = new Map(doc.pages.map((p) => [p.id, p]));
  const media = (id: string, s: ReelStill): StudioBlock => blockSchema.parse({ id, type: "image", assetId: s.assetId, title: s.caption, alt: s.alt });
  const projects: StudioPage[] = content.films.map((f) => {
    const blocks: StudioBlock[] = [];
    if (f.poster) blocks.push(media(`${f.id}-poster`, f.poster));
    if (f.video || f.link) blocks.push(blockSchema.parse({ id: `${f.id}-video`, type: "video", assetId: f.video?.assetId ?? "", note: f.link }));
    f.stills.forEach((s, i) => blocks.push(media(`${f.id}-s${i}`, s)));
    f.credits.forEach((c, i) => blocks.push(blockSchema.parse({ id: `${f.id}-c${i}`, type: "text", assetId: "", text: c })));
    return pageSchema.parse({ id: f.id, kind: "project", title: f.title, label: f.form, subtitle: f.synopsis, meta: [f.year, f.runtime, f.ratio].filter(Boolean).join(" · "), inNav: known.get(f.id)?.inNav ?? true, blocks });
  });
  const first = doc.pages.findIndex((p) => p.kind === "project");
  const others = doc.pages.filter((p) => p.kind !== "project").map((p) => (p.kind !== "home" ? p : { ...p, title: content.site.titleEm ? `${content.site.title} | ${content.site.titleEm}` : content.site.title, subtitle: content.site.note, meta: content.site.kicker }));
  const at = first < 0 ? others.length : doc.pages.slice(0, first).filter((p) => p.kind !== "project").length;
  return studioSchema.parse({ ...doc, name: content.site.name, pages: [...others.slice(0, at), ...projects, ...others.slice(at)] });
}

/* ------------------------------------------------------------------ Atelier */

export type AtelierImage = { assetId: string; src: string; w: number; h: number; alt: string; title: string; caption: string };
export type AtelierProject = {
  id: string; title: string; discipline: string; client: string; year: string; summary: string;
  facts: string[]; outcome: AtelierImage[]; process: AtelierImage[]; compare: boolean;
};
export type AtelierContent = {
  site: { name: string; kicker: string; title: string; titleEm: string; note: string; aboutTitle: string; about: string[]; principles: string[]; contact: string };
  projects: AtelierProject[];
};

const parseProjectMeta = (meta: string) => {
  const parts = meta.split("·").map((p) => p.trim()).filter(Boolean);
  const year = parts.find((p) => /^\d{4}$/.test(p)) ?? "";
  return { year, client: parts.filter((p) => p !== year).join(" · ") };
};

/**
 * Each project page is a project. Images marked as process are its steps, in order; the others are its outcome.
 * If the first step hangs with the next (`arrange: "with-next"`), it is set against the outcome in a comparison.
 * Text blocks are the facts (role, scope). On the about page, text blocks marked as a pause are the studio's principles.
 */
export function toAtelierContent(doc: StudioDocument, resolve: (assetId: string) => RoomAsset): AtelierContent {
  const home = doc.pages.find((p) => p.kind === "home");
  const about = doc.pages.find((p) => p.kind === "about");
  const [title, titleEm] = splitTitle(home?.title ?? doc.name);
  const im = (b: StudioBlock): AtelierImage => { const a = resolve(b.assetId); return { assetId: b.assetId, src: a.src, w: a.w, h: a.h, alt: b.alt || b.title, title: b.title, caption: b.caption }; };
  const projects: AtelierProject[] = doc.pages.filter((p) => p.kind === "project").map((p) => {
    const proj: AtelierProject = { id: p.id, title: p.title, discipline: p.label, ...parseProjectMeta(p.meta), summary: p.subtitle, facts: [], outcome: [], process: [], compare: false };
    for (const b of p.blocks) {
      if (b.type === "text") { if (b.text.trim()) proj.facts.push(b.text); }
      else if (b.role === "process") { if (!proj.process.length && b.arrange === "with-next") proj.compare = true; proj.process.push(im(b)); }
      else proj.outcome.push(im(b));
    }
    if (!proj.outcome.length || !proj.process.length) proj.compare = false;
    return proj;
  });
  const abouts = (about?.blocks ?? []).filter((b) => b.type === "text" && b.text.trim());
  return {
    site: {
      name: doc.name, kicker: home?.meta ?? "", title, titleEm, note: home?.subtitle ?? "", aboutTitle: about?.title ?? "The studio",
      about: abouts.filter((b) => b.role !== "pause").map((b) => b.text), principles: abouts.filter((b) => b.role === "pause").map((b) => b.text), contact: doc.tagline,
    },
    projects,
  };
}

export function fromAtelierContent(doc: StudioDocument, content: Pick<AtelierContent, "site" | "projects">): StudioDocument {
  const known = new Map(doc.pages.map((p) => [p.id, p]));
  const block = (id: string, i: AtelierImage, extra: object = {}): StudioBlock => blockSchema.parse({ id, type: "image", assetId: i.assetId, title: i.title, caption: i.caption, alt: i.alt, ...extra });
  const projects: StudioPage[] = content.projects.map((pr) => {
    const blocks: StudioBlock[] = [
      ...pr.outcome.map((i, k) => block(`${pr.id}-o${k}`, i)),
      ...pr.process.map((i, k) => block(`${pr.id}-p${k}`, i, { role: "process", arrange: k === 0 && pr.compare ? "with-next" : "alone" })),
      ...pr.facts.map((t, k) => blockSchema.parse({ id: `${pr.id}-f${k}`, type: "text", assetId: "", text: t })),
    ];
    return pageSchema.parse({ id: pr.id, kind: "project", title: pr.title, label: pr.discipline, subtitle: pr.summary, meta: [pr.client, pr.year].filter(Boolean).join(" · "), inNav: known.get(pr.id)?.inNav ?? true, blocks });
  });
  const first = doc.pages.findIndex((p) => p.kind === "project");
  const s = content.site;
  const others = doc.pages.filter((p) => p.kind !== "project").map((p) => {
    if (p.kind === "home") return { ...p, title: s.titleEm ? `${s.title} | ${s.titleEm}` : s.title, subtitle: s.note, meta: s.kicker };
    if (p.kind === "about") return pageSchema.parse({ ...p, title: s.aboutTitle, blocks: [
      ...s.about.map((t, k) => blockSchema.parse({ id: `${p.id}-a${k}`, type: "text", assetId: "", text: t })),
      ...s.principles.map((t, k) => blockSchema.parse({ id: `${p.id}-q${k}`, type: "text", assetId: "", text: t, role: "pause" })),
    ] });
    return p;
  });
  const at = first < 0 ? others.length : doc.pages.slice(0, first).filter((p) => p.kind !== "project").length;
  return studioSchema.parse({ ...doc, name: s.name, pages: [...others.slice(0, at), ...projects, ...others.slice(at)] });
}
