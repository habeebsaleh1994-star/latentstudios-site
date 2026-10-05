import {
  additionalSampleInfo,
  createAdditionalSample,
} from "./additionalSamples";
import { sectionFor } from "./composition";
import {
  initialSite,
  defaultIdentity,
  siteSchema,
  type Site,
  type Block,
  type Page,
} from "./model";
import { type SampleId } from "./sampleIds";
export { sampleIds, type SampleId } from "./sampleIds";
export const sampleInfo = {
  ...additionalSampleInfo,
  mara: {
    name: "Mara Ellis",
    practice: "Photographer",
    description: "Quiet observation, warm paper, literary type.",
    style: "Folio",
    color: "#d9dfce",
    image: "/media/sea.jpg",
  },
  sora: {
    name: "Sora Vale",
    practice: "Visual artist",
    description: "Cobalt, generous walls, and unapologetic form.",
    style: "Gallery",
    color: "#183eaf",
    image: "/media/form-blue.svg",
  },
  noor: {
    name: "Noor Rahal",
    practice: "Writer & poet",
    description: "A plum-toned index of poems, fragments, and places.",
    style: "Archive",
    color: "#674857",
    image: "",
  },
  ivo: {
    name: "Ivo Sen",
    practice: "Filmmaker",
    description: "An after-dark programme of light and duration.",
    style: "Cinema",
    color: "#151a1a",
    image: "/media/mountain.jpg",
  },
};
const text = (id: string, value: string): Block => ({
  id,
  type: "text",
  text: value,
  assetId: "",
  caption: "",
  alt: "",
  width: "inset",
  fit: "original",
  focal: { x: 50, y: 50 },
});
const media = (
  id: string,
  assetId: string,
  caption: string,
  alt: string,
  type: Block["type"] = "image",
): Block => ({ ...text(id, ""), type, assetId, caption, alt, width: "full" });
const page = (
  id: string,
  kind: Page["kind"],
  title: string,
  subtitle: string,
  meta: string,
  blocks: Block[],
  label = title,
): Page => ({
  id,
  kind,
  title,
  subtitle,
  meta,
  blocks,
  composition: null,
  label,
  inNav: kind !== "project",
});
export function createSample(id: SampleId): Site {
  if (id !== "mara" && id !== "sora" && id !== "noor" && id !== "ivo")
    return createAdditionalSample(id);
  const s = structuredClone(initialSite);
  if (id === "mara") return arrangeSample(s, id);
  const info = sampleInfo[id];
  s.name = info.name;
  s.tagline = info.practice;
  s.email = "";
  if (id === "sora") {
    s.styleId = "gallery";
    s.pages = [
      page(
        "home",
        "home",
        "Form is a\nway of thinking.",
        "Paintings, constructed images, and conversations between colours.",
        "Selected works / 2024—2026",
        [],
        "Work",
      ),
      page(
        "blue",
        "project",
        "Intervals in blue",
        "Three propositions for a room. Each work is an original geometric demo composition.",
        "Colour studies / 2026",
        [
          media(
            "b1",
            "formBlue",
            "I. A space within a space",
            "Cobalt field with an ivory circle and a vermilion bar",
          ),
          media(
            "b2",
            "formYellow",
            "II. Holding the sun",
            "Yellow circle and cobalt rectangles on warm paper",
          ),
          text(
            "b3",
            "A line does not divide the room.\nIt gives each colour somewhere to begin.",
          ),
        ],
      ),
      page(
        "red",
        "project",
        "The red between",
        "A study of weight, overlap, and the thing left open.",
        "Constructed image / 2025",
        [
          media(
            "r1",
            "formRed",
            "I. The red between",
            "Vermilion rectangle interrupted by a pale arch",
          ),
          text(
            "r2",
            "I begin with two colours.\nThe third is the space they make together.",
          ),
        ],
      ),
      page(
        "about",
        "about",
        "A practice of making room.",
        "Sora Vale is a fictional artist used to explore this editor.",
        "About the practice",
        [
          text(
            "sa",
            "Working between painting and constructed images, Sora studies how colour changes the way a room is felt. These sample works are original vector compositions made for this local demonstration.",
          ),
        ],
        "About",
      ),
    ];
    s.appearances.gallery.identity = {
      ...defaultIdentity,
      canvas: "#f0f0e8",
      ink: "#132c8a",
      accent: "#b32c20",
      headingFont: "sans",
      bodyFont: "sans",
      headingScale: 112,
      weight: "600",
      tracking: -5,
      margin: 8,
      imageScale: 85,
    };
    s.copy.eyebrow = "Colour / form / space";
  } else if (id === "noor") {
    s.styleId = "archive";
    s.pages = [
      page(
        "home",
        "home",
        "Words for\nwhat remains.",
        "Poems, letters, and unfinished thoughts.\nAn index, always in the making.",
        "A writing room / Volume 01",
        [],
        "Index",
      ),
      page(
        "threshold",
        "writing",
        "At the threshold",
        "A poem in three small movements.",
        "Poem / 2026",
        [
          text(
            "n1",
            "The door remembers\nthe shape of every leaving.\n\nAt dusk I place a chair\nwhere the light used to be.\n\nNothing returns entire.\nNot even the afternoon.",
          ),
        ],
        "Threshold",
      ),
      page(
        "letters",
        "writing",
        "Letters to a room",
        "On attention, distance, and the ordinary.",
        "Notebook / 2025",
        [
          text(
            "n2",
            "Dear room,\n\nI have been calling your silence empty. I see now that it is simply arranged differently from mine.\n\nThe cup on the table. The mark beside the window. Each thing is holding its place without needing to explain itself.",
          ),
          text("n3", "I am trying to learn that kind of patience."),
        ],
        "Letters",
      ),
      page(
        "margin",
        "writing",
        "A note in the margin",
        "A sentence that wanted a page of its own.",
        "Fragment / 2026",
        [
          text(
            "n4",
            "Perhaps home is not the place we return to,\nbut the small part of us that keeps a light on.",
          ),
        ],
        "Margins",
      ),
      page(
        "about",
        "about",
        "Writing as a way of staying.",
        "Noor Rahal is a fictional poet created for this local study.",
        "About",
        [
          text(
            "n5",
            "These poems and fragments are original sample writing. This is a simulated artist identity, not a claim about an actual writer or reader research.",
          ),
        ],
        "About",
      ),
    ];
    s.appearances.archive.identity = {
      ...defaultIdentity,
      canvas: "#eee4d5",
      ink: "#482c42",
      accent: "#753c34",
      headingFont: "humanist",
      bodyFont: "serif",
      headingScale: 96,
      bodyScale: 108,
      tracking: -3,
      margin: 9,
      imageScale: 75,
      leading: 1.85,
    };
  } else {
    s.styleId = "cinema";
    s.pages = [
      page(
        "home",
        "home",
        "Between light\nand leaving.",
        "Moving-image studies by Ivo Sen.\nA programme of imagined places.",
        "Films / fragments / 2026",
        [],
        "Programme",
      ),
      page(
        "weather",
        "project",
        "After the frame",
        "A fictional film notebook. Photographs act as location studies; the short abstract clip is an original local demo.",
        "Moving-image study / 2026",
        [
          media(
            "i1",
            "mountain",
            "01. A place before a story",
            "Mountain ridge beneath a pale sky",
          ),
          media(
            "i2",
            "studyFilm",
            "02. Two seconds of light",
            "Original abstract light study, two seconds",
            "video",
          ),
          text("i3", "Hold the shot.\nLet the place move first."),
          media(
            "i4",
            "sea",
            "03. The last sound is water",
            "Open sea under a fading sky",
          ),
        ],
      ),
      page(
        "night",
        "project",
        "The hours in between",
        "A notebook for a film that does not hurry.",
        "Location notebook / Ongoing",
        [
          media(
            "i5",
            "forest",
            "I. Listening for the room",
            "Forest lit by narrow shafts of sunlight",
          ),
          text(
            "i6",
            "The camera waits at the edge of the clearing.\nWe hear the world before we see it.",
          ),
        ],
      ),
      page(
        "about",
        "about",
        "Ivo Sen / moving images",
        "A fictional filmmaker identity for this local demonstration.",
        "Practice & contact",
        [
          text(
            "i7",
            "Ivo's fictional practice moves between landscape, duration, and short-form film. The licensed photographs and original test film demonstrate mixed-media authoring; they are not a real filmmaker's portfolio.",
          ),
        ],
        "About",
      ),
    ];
    s.appearances.cinema.identity = {
      ...defaultIdentity,
      canvas: "#151a1a",
      ink: "#f3f0df",
      accent: "#dfef80",
      headingFont: "sans",
      bodyFont: "mono",
      headingScale: 105,
      tracking: -6,
      margin: 6,
      imageScale: 90,
    };
    s.copy.programmeNote = "Independent moving images";
  }
  return siteSchema.parse(arrangeSample(s, id));
}

/** Authored starting arrangements for NEW demo stores only. Existing drafts are never replaced. */
function arrangeSample(site: Site, id: "mara" | "sora" | "noor" | "ivo"): Site {
  const pageId = {
    mara: "quiet",
    sora: "blue",
    noor: "letters",
    ivo: "weather",
  }[id];
  const page = site.pages.find((p) => p.id === pageId)!;
  const blocks = page.blocks.map((b) => b.id);
  const section = (keys: string[], n: number) =>
    sectionFor(keys, `sample-${id}-${n}`);
  const sections =
    id === "mara"
      ? [section(blocks.slice(0, 2), 1), section(blocks.slice(2), 2)]
      : id === "sora"
        ? [section(blocks.slice(0, 2), 1), section(blocks.slice(2), 2)]
        : id === "noor"
          ? [section(blocks, 1)]
          : [
              section([blocks[0]], 1),
              section(blocks.slice(1, 3), 2),
              section([blocks[3]], 3),
            ];
  const lead = sections[id === "ivo" ? 1 : 0];
  lead.layout = "emphasis-left";
  lead.vertical = id === "noor" ? "end" : "center";
  lead.width = id === "sora" || id === "noor" ? "wide" : "full";
  const phone = sections.map((s) => ({
    ...sectionFor([...s.blockIds], `mobile-${s.id}`, true),
    align: s.align,
    vertical: s.vertical,
  }));
  const phoneLead = phone[id === "ivo" ? 1 : 0];
  if (id !== "noor") phoneLead.blockIds.reverse();
  if (id === "mara") phoneLead.gap = 8;
  const mobile =
    id === "sora"
      ? [phone[1], phone[0]]
      : id === "ivo"
        ? [phone[1], phone[0], phone[2]]
        : phone;
  page.composition = { enabled: true, desktop: sections, mobile };
  return site;
}
