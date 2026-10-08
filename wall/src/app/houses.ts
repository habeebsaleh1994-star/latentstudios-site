/*
 * Templates. A template makes the big decisions for the artist, so they are not flooded with them:
 * its skeleton, which arrangements its stories use, its front page, the looks and typefaces that suit it.
 * Inside, the choices are rich, but every one is a variation the template itself offers: the first value
 * of each list is the template's own, and nothing outside the lists is ever shown. So a template can be
 * made one's own, and can never be turned into another template.
 */
import type { Theme } from "../studio/site";
import type { ArrangementId, HouseId, SiteDocument } from "../studio/site";

export type Dial = "header" | "opening" | "title" | "captions" | "footer" | "scale";
type Allow<K extends keyof Theme> = NonNullable<Theme[K]>[];
export type House = {
  id: HouseId; name: string; for: string; idea: string;
  /** What leads on the front page and in the menu: the kind of work this template is for. */
  leads: ("story" | "writing" | "film" | "project")[]; menu: string;
  /** Its signature: what this template is, in one line, and what it decides. */
  owns: string;
  arrangements: ArrangementId[]; fronts: SiteDocument["front"]["form"][];
  dials: { [K in Dial]: Allow<K> };
  looks: string[];
  /** null = the look's own pairing */
  typefaces: (Theme["typeface"])[];
  details?: Partial<Pick<Theme, "mount" | "space" | "palette">>;
};

export const HOUSES: House[] = [
  { id: "folio", name: "Folio", for: "Photographers", leads: ["story"], menu: "Work", idea: "One work at a time, held large and still, with a caption like a print mount.",
    owns: "Every work held on its own or in pairs, down the page; captions as a print mount.",
    arrangements: ["held", "contact", "book"], fronts: ["covers", "list"],
    dials: { header: ["classic", "centred"], opening: ["words", "image"], title: ["accent", "plain", "quiet"], captions: ["under", "beside", "hidden"], footer: ["line", "large"], scale: ["standard", "intimate", "monumental"] },
    looks: ["quiet", "proof", "toned", "graphite", "etching", "cyanotype", "monotype", "darkroom"], typefaces: [null, "newsreader", "caslon", "instrument", "bodoni", "fraunces"] },
  { id: "gallery", name: "Gallery", for: "Photographers and artists", leads: ["story"], menu: "Work", idea: "A white wall and great space. The name alone at the top; the work first, its words when pointed at.",
    owns: "A white cube: the work first, the name alone, words as wall labels.",
    arrangements: ["contact", "held", "wall"], fronts: ["sheet", "list"],
    dials: { header: ["name", "centred"], opening: ["work", "name"], title: ["plain", "caps"], captions: ["hover", "under", "hidden"], footer: ["minimal"], scale: ["monumental", "standard"] },
    looks: ["gallery", "graphite", "monotype"], typefaces: ["grotesk", "jost", "archivo", "instrument"], details: { space: "airy" } },
  { id: "monograph", name: "Monograph", for: "Photographers who make books", leads: ["story"], menu: "Contents", idea: "Your name as the cover, each series as spreads turned like a photobook, captions in the margin.",
    owns: "The site as a book: your name as the cover, a contents page, every series as spreads.",
    arrangements: ["book"], fronts: ["list"],
    dials: { header: ["stacked", "centred"], opening: ["name", "words"], title: ["plain", "accent"], captions: ["beside", "under"], footer: ["large", "line"], scale: ["intimate", "standard"] },
    looks: ["toned", "etching", "cyanotype", "quiet"], typefaces: ["caslon", "newsreader", "bodoni", "fraunces", "young"], details: { mount: "line" } },
  { id: "passage", name: "Passage", for: "Photographers who work in long series", leads: ["story"], menu: "Work", idea: "A dark room and one long walk past the work: the front page and every story, sideways, on one line.",
    owns: "One walk: the front page and every story hung along a wall, crossed sideways, in a dark room.",
    arrangements: ["passage", "slides"], fronts: ["walk", "covers"],
    dials: { header: ["name", "classic"], opening: ["work", "image"], title: ["quiet", "caps"], captions: ["hover", "under"], footer: ["minimal"], scale: ["monumental", "standard"] },
    looks: ["darkroom", "monotype", "graphite", "gallery"], typefaces: ["plex", "courier", "grotesk", "jost"] },
  { id: "reel", name: "Reel", for: "Filmmakers", leads: ["film"], menu: "Films", idea: "Films lead: the site opens on a still from your first film, each film at its own ratio, in the dark.",
    owns: "Film first: films lead the site, it opens on a still from the first, every film at its own ratio.",
    arrangements: ["slides", "passage", "held"], fronts: ["covers", "sheet"],
    dials: { header: ["classic", "name"], opening: ["image", "words"], title: ["caps", "plain"], captions: ["under", "hidden"], footer: ["minimal", "line"], scale: ["monumental"] },
    looks: ["cinema", "darkroom", "monotype", "gallery"], typefaces: [null, "bodoni", "grotesk", "archivo", "plex"] },
  { id: "salon", name: "Salon", for: "Painters and visual artists", leads: ["story"], menu: "Works", idea: "Works hung together at their true size, a centred header and a quiet introduction, plates under each wall.",
    owns: "True relative scale: works hung on walls at their real sizes, and every work given its dimensions.",
    arrangements: ["wall", "held"], fronts: ["covers", "sheet"],
    dials: { header: ["centred", "classic"], opening: ["words", "image"], title: ["accent", "plain"], captions: ["under"], footer: ["large", "line"], scale: ["standard", "intimate"] },
    looks: ["plaster", "gallery", "toned", "etching", "quiet"], typefaces: ["caslon", "newsreader", "instrument", "fraunces"] },
  { id: "index", name: "Index", for: "Writers and poets", leads: ["writing"], menu: "Writing", idea: "Words lead: writing first in the contents, a side column for your name and the pages, quiet titles.",
    owns: "Words first: writing leads the contents, a side column, pages set like a book.",
    arrangements: ["held", "book"], fronts: ["list"],
    dials: { header: ["rail", "stacked"], opening: ["words", "name"], title: ["quiet", "plain", "accent"], captions: ["under", "hidden"], footer: ["minimal", "line"], scale: ["intimate"] },
    looks: ["quiet", "paperback", "toned", "cyanotype", "graphite"], typefaces: ["archive", "newsreader", "caslon", "young", "courier"], details: { palette: "bone" } },
  { id: "atelier", name: "Atelier", for: "Studios and designers", leads: ["project"], menu: "Projects", idea: "Projects lead, as case studies: process beside outcome, a grid, your name set large at the foot.",
    owns: "Projects lead: case studies with process beside outcome, a grid, the studio's name at the foot.",
    arrangements: ["contact", "held"], fronts: ["sheet", "list"],
    dials: { header: ["classic", "stacked"], opening: ["words", "work"], title: ["plain", "caps"], captions: ["beside", "under"], footer: ["large"], scale: ["standard"] },
    looks: ["swiss", "blueprint", "gallery", "soft", "zine"], typefaces: ["archivo", "grotesk", "jost", "plex"], details: { space: "close" } },
  { id: "lantern", name: "Lantern", for: "Photographers who tell stories in sequence", leads: ["story"], menu: "Work", idea: "One slide at a time in the middle of the screen, like a lantern show; titles in capitals on an early print's cream.",
    owns: "A slide show: every story shown one slide at a time, the arrow keys moving through it.",
    arrangements: ["slides"], fronts: ["covers"],
    dials: { header: ["name", "centred"], opening: ["words", "name"], title: ["caps", "plain"], captions: ["under", "hidden"], footer: ["line"], scale: ["standard"] },
    looks: ["albumen", "toned", "cyanotype", "monotype"], typefaces: [null, "caslon", "bodoni", "newsreader"] },
];
export const house = (id: string) => HOUSES.find((h) => h.id === id) ?? HOUSES[0];
export const DIALS: Dial[] = ["header", "opening", "title", "captions", "footer", "scale"];

/** The template's own starting theme: the first of each of its lists. */
export function houseTheme(h: House): Partial<Theme> {
  // a template decides its own light, so it looks the same whatever the visitor's device is set to; under Quiet the artist can change it
  const t: Partial<Theme> = { look: h.looks[0] as Theme["look"], typeface: h.typefaces[0] ?? null, accent: null, mount: "bare", space: "standard", mode: "light", palette: "silk", ...h.details };
  for (const d of DIALS) (t as Record<string, unknown>)[d] = h.dials[d][0];
  return t;
}
/** Is this value one the template offers? Anything else is refused, so the template stays itself. */
export function allows(h: House, key: string, value: unknown): boolean {
  if ((DIALS as string[]).includes(key)) return (h.dials[key as Dial] as unknown[]).includes(value);
  if (key === "look") return h.looks.includes(value as string);
  if (key === "typeface") return h.typefaces.includes((value ?? null) as Theme["typeface"]);
  return true;
}
