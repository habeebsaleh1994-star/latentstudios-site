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
  details?: Partial<Pick<Theme, "mount" | "space" | "palette" | "mode">>;
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
    looks: ["gallery", "graphite", "monotype", "swiss", "quiet", "darkroom"], typefaces: ["grotesk", "jost", "archivo", "instrument", "plex"], details: { space: "airy" } },
  { id: "monograph", name: "Monograph", for: "Photographers who make books", leads: ["story"], menu: "Contents", idea: "Your name as the cover, each series as spreads turned like a photobook, captions in the margin.",
    owns: "The site as a book: your name as the cover, a contents page, every series as spreads.",
    arrangements: ["book"], fronts: ["list"],
    dials: { header: ["stacked", "centred"], opening: ["name", "words"], title: ["plain", "accent"], captions: ["beside"], footer: ["large", "line"], scale: ["intimate", "standard"] },
    looks: ["toned", "etching", "cyanotype", "quiet", "monotype", "graphite", "darkroom"], typefaces: ["caslon", "newsreader", "bodoni", "fraunces", "young", "instrument"], details: { mount: "line" } },
  { id: "passage", name: "Passage", for: "Photographers who work in long series", leads: ["story"], menu: "Work", idea: "A dark room and one long walk past the work: the front page and every story, sideways, on one line.",
    owns: "One walk: the front page and every story hung along a wall, crossed sideways, in a dark room.",
    arrangements: ["passage", "slides"], fronts: ["walk", "covers"],
    dials: { header: ["name", "classic"], opening: ["work", "image"], title: ["quiet", "caps"], captions: ["hover", "under"], footer: ["minimal"], scale: ["monumental", "standard"] },
    looks: ["darkroom", "monotype", "graphite", "gallery", "cyanotype", "toned"], typefaces: ["plex", "courier", "grotesk", "jost", "newsreader"], details: { mode: "dark" } },
  { id: "reel", name: "Reel", for: "Filmmakers", leads: ["film"], menu: "Films", idea: "Films lead: the site opens on a still from your first film, each film at its own ratio, in the dark.",
    owns: "Film first: films lead the site, it opens on a still from the first, every film at its own ratio.",
    arrangements: ["slides", "passage", "held"], fronts: ["covers", "sheet"],
    dials: { header: ["classic", "name"], opening: ["image", "words"], title: ["caps", "plain"], captions: ["under", "hidden"], footer: ["minimal", "line"], scale: ["monumental"] },
    looks: ["cinema", "marquee", "silver", "darkroom", "monotype", "gallery", "swiss", "graphite"], typefaces: [null, "bodoni", "grotesk", "archivo", "plex", "newsreader"], details: { mode: "dark" } },
  { id: "salon", name: "Salon", for: "Painters and visual artists", leads: ["story"], menu: "Works", idea: "Works hung together at their true size, a centred header and a quiet introduction, plates under each wall.",
    owns: "True relative scale: works hung on walls at their real sizes, and every work given its dimensions.",
    arrangements: ["wall", "held"], fronts: ["covers", "sheet"],
    dials: { header: ["centred", "classic"], opening: ["words", "image"], title: ["accent", "plain"], captions: ["under"], footer: ["large", "line"], scale: ["standard", "intimate"] },
    looks: ["plaster", "gesso", "gallery", "toned", "etching", "quiet", "monotype", "soft"], typefaces: ["caslon", "newsreader", "instrument", "fraunces", "bodoni"] },
  { id: "index", name: "Index", for: "Writers and poets", leads: ["writing"], menu: "Writing", idea: "Words lead: writing first in the contents, a side column for your name and the pages, quiet titles.",
    owns: "Words first: writing leads the contents, a side column, pages set like a book.",
    arrangements: ["held", "book"], fronts: ["list"],
    dials: { header: ["rail", "stacked"], opening: ["words", "name"], title: ["quiet", "plain", "accent"], captions: ["under", "hidden"], footer: ["minimal", "line"], scale: ["intimate"] },
    looks: ["quiet", "paperback", "typewriter", "toned", "cyanotype", "graphite", "etching", "monotype"], typefaces: ["archive", "newsreader", "caslon", "young", "courier", "fraunces"], details: { palette: "bone" } },
  { id: "atelier", name: "Atelier", for: "Studios and designers", leads: ["project"], menu: "Projects", idea: "Projects lead, as case studies: process beside outcome, a grid, your name set large at the foot.",
    owns: "Projects lead: case studies with process beside outcome, a grid, the studio's name at the foot.",
    arrangements: ["contact", "held"], fronts: ["sheet", "list"],
    dials: { header: ["classic", "stacked"], opening: ["words", "work"], title: ["plain", "caps"], captions: ["beside", "under"], footer: ["large"], scale: ["standard"] },
    looks: ["swiss", "blueprint", "riso", "gallery", "soft", "zine", "graphite", "darkroom"], typefaces: ["archivo", "grotesk", "jost", "plex", "instrument"], details: { space: "close" } },
  { id: "lantern", name: "Lantern", for: "Photographers who tell stories in sequence", leads: ["story"], menu: "Work", idea: "One slide at a time in the middle of the screen, like a lantern show; titles in capitals on an early print's cream.",
    owns: "A slide show: every story shown one slide at a time, the arrow keys moving through it.",
    arrangements: ["slides"], fronts: ["covers"],
    dials: { header: ["name", "centred"], opening: ["words", "name"], title: ["caps", "plain"], captions: ["under", "hidden"], footer: ["line"], scale: ["standard"] },
    looks: ["albumen", "toned", "cyanotype", "monotype", "darkroom", "graphite", "quiet"], typefaces: [null, "caslon", "bodoni", "newsreader", "instrument", "plex"] },
  { id: "journal", name: "Journal", for: "Photographers who shoot every day", leads: ["story"], menu: "Entries", idea: "A diary kept in photographs: dated entries, newest first, each a day's pictures held one at a time.",
    owns: "A chronology: the front page is a dated list of entries, and every story is a day.",
    arrangements: ["held", "contact"], fronts: ["journal", "list"],
    dials: { header: ["classic", "stacked"], opening: ["name", "words"], title: ["quiet", "plain"], captions: ["under", "hidden"], footer: ["line", "minimal"], scale: ["intimate", "standard"] },
    looks: ["quiet", "graphite", "toned", "etching", "monotype", "cyanotype"], typefaces: ["newsreader", "instrument", "caslon", "plex", "fraunces"] },
  { id: "column", name: "Column", for: "Essayists and critics", leads: ["writing"], menu: "Essays", idea: "A quiet magazine: essays dated and listed newest first, each set wide and read slowly.",
    owns: "Writing dated: the front page is a column of essays by date; photographs sit beside the words, never ahead of them.",
    arrangements: ["held"], fronts: ["journal", "list"],
    dials: { header: ["stacked", "classic"], opening: ["words", "name"], title: ["plain", "quiet"], captions: ["under"], footer: ["minimal", "line"], scale: ["standard"] },
    looks: ["quiet", "typewriter", "graphite", "toned", "swiss", "cyanotype", "etching"], typefaces: ["caslon", "newsreader", "archive", "grotesk", "young", "courier"] },
  { id: "catalogue", name: "Catalogue", for: "Painters, and the estates of artists", leads: ["story"], menu: "Catalogue", idea: "A catalogue raisonné: every work numbered, with its medium, dimensions and year; the pictures plain, the facts exact.",
    owns: "Numbering and facts: the front page is the catalogue of every work, and each series shows its works with their dimensions.",
    arrangements: ["held", "wall"], fronts: ["catalogue", "list"],
    dials: { header: ["centred", "classic"], opening: ["name", "words"], title: ["plain", "caps"], captions: ["beside", "under"], footer: ["line", "large"], scale: ["intimate", "standard"] },
    looks: ["etching", "gesso", "quiet", "gallery", "graphite", "toned", "monotype"], typefaces: ["caslon", "bodoni", "newsreader", "instrument", "archive"] },
  { id: "chapbook", name: "Chapbook", for: "Poets and short-form writers", leads: ["writing"], menu: "Poems", idea: "The site opens into the reading: the poems one after another on a single page, large and unhurried; everything else waits at the end.",
    owns: "Reading first: the front page is the writing itself, set large, one piece after another.",
    arrangements: ["held"], fronts: ["reading", "list"],
    dials: { header: ["name", "rail"], opening: ["work", "words"], title: ["quiet", "plain"], captions: ["hidden"], footer: ["minimal"], scale: ["intimate"] },
    looks: ["toned", "typewriter", "quiet", "etching", "graphite", "cyanotype", "monotype"], typefaces: ["caslon", "newsreader", "young", "fraunces", "archive", "courier"] },
  { id: "cinema", name: "Cinema", for: "Filmmakers with more than one film", leads: ["film"], menu: "Films", idea: "A poster wall: every film as its poster at its own ratio, the house lights down; each film a programme page.",
    owns: "Posters lead: the front page is a wall of posters, and the site is dark by nature.",
    arrangements: ["slides", "held"], fronts: ["posters", "sheet"],
    dials: { header: ["centred", "name"], opening: ["work", "name"], title: ["caps", "plain"], captions: ["hidden", "under"], footer: ["minimal", "line"], scale: ["monumental", "standard"] },
    looks: ["darkroom", "marquee", "silver", "monotype", "gallery", "swiss", "graphite", "toned"], typefaces: ["bodoni", "archivo", "grotesk", "plex", "newsreader"], details: { mode: "dark" } },
  { id: "ledger", name: "Ledger", for: "Design studios and architects", leads: ["project"], menu: "Projects", idea: "The work as a ledger: a table of projects, clients, disciplines and years, nothing decorative; each row opens the case.",
    owns: "A table first: the front page is a ledger of projects; pictures are kept for the project pages.",
    arrangements: ["contact", "held"], fronts: ["ledger", "list"],
    dials: { header: ["rail", "classic"], opening: ["words", "name"], title: ["plain", "caps"], captions: ["under", "hidden"], footer: ["minimal", "large"], scale: ["standard", "intimate"] },
    looks: ["swiss", "gallery", "graphite", "darkroom", "zine", "soft"], typefaces: ["plex", "grotesk", "archivo", "jost", "courier"] },
  { id: "pinboard", name: "Pinboard", for: "Illustrators and printmakers", leads: ["story"], menu: "Work", idea: "Many small works pinned close on one wall, at their own proportions, a few larger; the eye wanders.",
    owns: "A board: every story is a wall of pins, dense and harmonious, the larger ones across two.",
    arrangements: ["board", "held"], fronts: ["covers", "sheet"],
    dials: { header: ["classic", "centred"], opening: ["work", "words"], title: ["plain", "accent"], captions: ["hover", "under"], footer: ["large", "line"], scale: ["standard", "intimate"] },
    looks: ["soft", "riso", "zine", "gesso", "quiet", "toned", "gallery", "graphite"], typefaces: ["fraunces", "young", "jost", "newsreader", "instrument", "archivo"] },
  { id: "studio", name: "Studio", for: "Painters who show the making", leads: ["story", "project"], menu: "Work", idea: "The studio wall and the finished plate: works pinned as they are made, hung at true size when done, process beside outcome.",
    owns: "Making and made: boards for work in progress, walls at true size for the finished, projects with process beside outcome.",
    arrangements: ["board", "wall", "held"], fronts: ["covers", "walk"],
    dials: { header: ["stacked", "name"], opening: ["image", "words"], title: ["accent", "plain"], captions: ["beside", "under"], footer: ["line", "minimal"], scale: ["monumental", "standard"] },
    looks: ["etching", "gesso", "toned", "monotype", "riso", "quiet", "graphite", "soft"], typefaces: ["instrument", "caslon", "bodoni", "fraunces", "grotesk"] },
  { id: "archive", name: "Archive", for: "Artists whose work takes many forms", leads: ["story", "film", "writing", "project"], menu: "Archive", idea: "One chronology of everything: photographs, films, writing and projects in the order they were made, with a filter by kind.",
    owns: "Everything in time: the front page is an archive of every page by date, sifted by kind.",
    arrangements: ["held", "contact"], fronts: ["archive", "list"],
    dials: { header: ["rail", "stacked"], opening: ["name", "words"], title: ["plain", "quiet"], captions: ["under", "hidden"], footer: ["minimal", "line"], scale: ["standard", "intimate"] },
    looks: ["graphite", "quiet", "swiss", "toned", "darkroom", "gallery"], typefaces: ["instrument", "plex", "newsreader", "grotesk", "archive"] },
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
  if (key === "typeface") return value == null || h.typefaces.includes(value as Theme["typeface"]); // the look's own pairing stands in every template
  return true;
}
