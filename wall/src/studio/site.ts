/*
 * Site document, version 15.
 *
 * Version 14 described one template's page. Version 15 describes the artist's whole site:
 *
 * - a library of works. A photograph's own facts (title, date, medium, alt text, focal point,
 *   real size) live once, with the work; a page only refers to it. So one photograph can sit in
 *   two stories, and work arriving from the apps lands in the library first.
 * - pages of several kinds (story, writing, film, project, about, contact), each with its own
 *   address. A story chooses its arrangement (held, book, passage, contact, wall, slides).
 * - a front page with its own form and words.
 * - the theme, unchanged from version 14: the look and the artist's own choices under it.
 *
 * The house (what version 14 called the room) decides which arrangements and looks are offered;
 * the document keeps only intent, never geometry.
 */
import { z } from "zod";

export const SITE_VERSION = 15 as const;

/* ------------------------------------------------------------------ the theme: the look and the artist's choices under it */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const lookIds = ["quiet", "swiss", "darkroom", "zine", "gallery", "soft", "toned", "cyanotype", "graphite", "etching", "monotype", "albumen", "proof", "paperback", "plaster", "cinema", "blueprint", "marquee", "silver", "riso", "typewriter", "gesso"] as const;
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
    /* The site's skeleton, each part a designed choice. A template sets them; the artist can change every one. */
    header: z.enum(["classic", "centred", "stacked", "rail", "name"]).default("classic"),
    opening: z.enum(["words", "image", "name", "work"]).default("words"),
    title: z.enum(["accent", "plain", "quiet", "caps"]).default("accent"),
    captions: z.enum(["under", "beside", "hover", "hidden"]).default("under"),
    footer: z.enum(["line", "large", "minimal"]).default("line"),
    scale: z.enum(["intimate", "standard", "monumental"]).default("standard"),
    /** A typeface pairing that wins over the look's own; null keeps the look's. */
    typeface: z.enum(["newsreader", "caslon", "instrument", "archive", "bodoni", "fraunces", "young", "archivo", "grotesk", "jost", "plex", "courier"]).nullable().default(null),
  })
  .strict();
export type Theme = z.infer<typeof themeSchema>;

const short = z.string().max(500);
const id = z.string().min(1).max(80);

export const houseIds = ["folio", "gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern", "journal", "column", "catalogue", "chapbook", "cinema", "ledger", "pinboard", "studio", "archive", "manuscript"] as const;
export type HouseId = (typeof houseIds)[number];

/* ------------------------------------------------------------------ the library */

export const workSchema = z
  .object({
    kind: z.enum(["image", "video"]).default("image"),
    /** Pixel size of the file as kept; the renderer needs the proportion before the image loads. */
    w: z.number().int().min(1).max(20000),
    h: z.number().int().min(1).max(20000),
    title: short.default(""),
    date: z.string().max(40).default(""),
    /** Medium for a painting, a step's description for process work, a still's line for a film. */
    caption: short.default(""),
    alt: short.default(""),
    focal: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).default({ x: 50, y: 50 }),
    /** The back of the print: where, a line in the artist's hand, the edition, how it was made. Shown when the work is turned over. */
    verso: z.object({ place: short.default(""), line: z.string().max(1000).default(""), edition: short.default(""), made: z.string().max(1000).default("") }).strict().default({ place: "", line: "", edition: "", made: "" }),
    /** The work's real size in centimetres, when the artist has given it. */
    size: z.object({ w: z.number().min(1).max(2000), h: z.number().min(1).max(2000) }).nullable().default(null),
  })
  .strict();
export type Work = z.infer<typeof workSchema>;

/* ------------------------------------------------------------------ pages */

/** A story is a sequence of works and pauses. How each work sits is intent: alone, with the next one, with a margin note. */
export const pieceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("work"),
    asset: id,
    arrange: z.enum(["alone", "with-next", "margin-note"]).default("alone"),
    note: short.default(""),
    /** Run across both pages in a book, across the screen elsewhere. */
    full: z.boolean().default(false),
  }).strict(),
  z.object({ type: z.literal("pause"), label: short.default(""), text: z.string().max(5000) }).strict(),
]);
export type Piece = z.infer<typeof pieceSchema>;

export const arrangementIds = ["held", "book", "passage", "contact", "wall", "slides", "board", "leaves"] as const;
export type ArrangementId = (typeof arrangementIds)[number];

/** How a page appears elsewhere: in a search result, as a link sent to someone. Empty means "from the page itself". */
export const appearsSchema = z.object({ title: short.default(""), description: short.default(""), share: id.nullable().default(null) }).strict().default({ title: "", description: "", share: null });
/** A page behind a word is shown to those who have it; empty means open. */
const common = { id, title: short, titleEm: short.default(""), inNav: z.boolean().default(true), appears: appearsSchema, word: short.default("") };

export const storyPageSchema = z.object({
  ...common, kind: z.literal("story"),
  kicker: short.default(""), note: z.string().max(5000).default(""),
  arrangement: z.enum(arrangementIds).default("held"),
  pieces: z.array(pieceSchema).max(200),
}).strict();

export const writingPageSchema = z.object({
  ...common, kind: z.literal("writing"),
  form: short.default(""), place: short.default(""), year: z.string().max(12).default(""),
  /** A poem is one paragraph with line breaks. */
  paras: z.array(z.string().max(30000)).max(200),
  margin: short.default(""),
  image: z.object({ asset: id, at: z.union([z.literal("cover"), z.number().int().min(0)]) }).nullable().default(null),
}).strict();

export const filmPageSchema = z.object({
  ...common, kind: z.literal("film"),
  form: short.default(""), year: z.string().max(12).default(""), runtime: z.string().max(40).default(""), ratio: z.string().max(20).default(""),
  synopsis: z.string().max(5000).default(""),
  poster: id.nullable().default(null), video: id.nullable().default(null), link: z.string().max(2000).default(""),
  /** A still's line belongs to this film, not to the photograph, which may appear elsewhere with another. */
  stills: z.array(z.object({ asset: id, caption: short.default("") }).strict()).max(100).default([]), credits: z.array(z.string().max(2000)).max(100).default([]),
}).strict();

export const projectPageSchema = z.object({
  ...common, kind: z.literal("project"),
  discipline: short.default(""), client: short.default(""), year: z.string().max(12).default(""), summary: z.string().max(5000).default(""),
  outcome: z.array(id).max(100).default([]), process: z.array(id).max(100).default([]),
  /** The first step of the process is set against the outcome in a comparison. */
  compare: z.boolean().default(false),
  facts: z.array(z.string().max(2000)).max(50).default([]),
}).strict();

export const aboutPageSchema = z.object({
  ...common, kind: z.literal("about"),
  paras: z.array(z.string().max(10000)).max(50).default([]),
  principles: z.array(z.string().max(2000)).max(20).default([]),
}).strict();

export const contactPageSchema = z.object({
  ...common, kind: z.literal("contact"),
  paras: z.array(z.string().max(10000)).max(50).default([]),
}).strict();

/** The record: a statement, then dated lists (exhibitions, publications, awards, collections, education), each a section. */
export const recordPageSchema = z.object({
  ...common, kind: z.literal("record"),
  paras: z.array(z.string().max(10000)).max(50).default([]),
  sections: z.array(z.object({ title: short, entries: z.array(z.object({ year: z.string().max(12).default(""), text: z.string().max(2000) }).strict()).max(200).default([]) }).strict()).max(30).default([]),
}).strict();

export const sitePageSchema = z.discriminatedUnion("kind", [storyPageSchema, writingPageSchema, filmPageSchema, projectPageSchema, aboutPageSchema, contactPageSchema, recordPageSchema]);
export type SitePage = z.infer<typeof sitePageSchema>;
export type StoryPage = z.infer<typeof storyPageSchema>;

export const frontSchema = z.object({
  form: z.enum(["covers", "list", "sheet", "walk", "journal", "catalogue", "reading", "posters", "ledger", "archive", "threshold"]).default("covers"),
  kicker: short.default(""), title: short.default(""), titleEm: short.default(""), note: z.string().max(5000).default(""),
}).strict();

export const siteSchema = z
  .object({
    version: z.literal(SITE_VERSION),
    house: z.enum(houseIds).default("folio"),
    name: short,
    /** The line at the foot of every page. */
    contact: short.default(""),
    email: z.union([z.literal(""), z.email()]).default(""),
    front: frontSchema,
    /** The site's own: a line for search engines when a page has none, and a share image when a page has no cover. */
    appears: z.object({ description: short.default(""), share: id.nullable().default(null) }).strict().default({ description: "", share: null }),
    /** The door: a word the whole site is behind, and "soon", which publishes only a holding page (with the door, when there is a word). */
    door: z.object({ word: short.default(""), soon: z.boolean().default(false), note: short.default("") }).strict().default({ word: "", soon: false, note: "" }),
    /** The artist's mark: a logo or wordmark shown in place of the name, when they have one; an icon for the browser tab and a phone's home screen (without one, their initial). */
    mark: z.object({ logo: id.nullable().default(null), icon: id.nullable().default(null) }).strict().default({ logo: null, icon: null }),
    theme: themeSchema,
    library: z.record(id, workSchema),
    pages: z.array(sitePageSchema).max(200),
    /** Removed pages, kept for thirty days so they can be put back. Never published. */
    trash: z.array(z.object({ page: sitePageSchema, removedAt: z.string() }).strict()).max(200).default([]),
  })
  .strict()
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    s.pages.forEach((p, i) => {
      if (seen.has(p.id)) ctx.addIssue({ code: "custom", path: ["pages", i, "id"], message: `Two pages share the address "${p.id}".` });
      seen.add(p.id);
      for (const a of assetsOf(p)) if (!(a in s.library)) ctx.addIssue({ code: "custom", path: ["pages", i], message: `Page "${p.id}" refers to "${a}", which is not in the library.` });
    });
    for (const a of siteAssets(s)) if (!(a in s.library)) ctx.addIssue({ code: "custom", path: ["mark"], message: `The site refers to "${a}", which is not in the library.` });
  });
export type SiteDocument = z.infer<typeof siteSchema>;

/** Every work a page refers to, in the order it shows them, then its own share image. */
export function assetsOf(p: SitePage): string[] {
  const own = (() => { switch (p.kind) {
    case "story": return p.pieces.flatMap((x) => (x.type === "work" ? [x.asset] : []));
    case "writing": return p.image ? [p.image.asset] : [];
    case "film": return [p.poster, p.video, ...p.stills.map((x) => x.asset)].filter((a): a is string => !!a);
    case "project": return [...p.outcome, ...p.process];
    default: return [];
  } })();
  return p.appears.share ? [...own, p.appears.share] : own;
}
/** What the site itself refers to: its logo and its own share image. */
export const siteAssets = (s: { mark: { logo: string | null; icon: string | null }; appears: { share: string | null } }) => [s.mark.logo, s.mark.icon, s.appears.share].filter((a): a is string => !!a);

/** Every work a removed page still refers to: kept in the library so the page can come back whole. */
export const assetsInTrash = (s: SiteDocument) => s.trash.flatMap((t) => assetsOf(t.page));
/** Which pages a work appears on, so the library can say "in The road, Late light". */
export function usesOf(site: SiteDocument, asset: string): string[] {
  return site.pages.filter((p) => assetsOf(p).includes(asset)).map((p) => p.id);
}

/** How many photographs the site shows (a work placed twice counts once), for plan limits. */
export function photographCount(site: SiteDocument): number {
  const placed = new Set([...site.pages.flatMap(assetsOf), ...siteAssets(site)]);
  return [...placed].filter((a) => site.library[a]?.kind !== "video").length;
}

/** Read a stored site. Only version 15 exists; nothing older is carried over. */
export function openSite(raw: unknown): SiteDocument {
  const v = (raw as { version?: number } | null)?.version;
  if (v !== SITE_VERSION) throw new Error(`This site was saved by a version Wall cannot open (${v ?? "none"}).`);
  return siteSchema.parse(raw);
}
