import {
  initialSite,
  siteSchema,
  type Block,
  type Page,
  type Site,
} from "./model";
export const additionalSampleIds = [
  "elena",
  "kai",
  "ada",
  "common",
  "lina",
  "remy",
] as const;
export type AdditionalSampleId = (typeof additionalSampleIds)[number];
export const additionalSampleInfo = {
  elena: {
    name: "Elena Voss",
    practice: "Photographer & editor",
    description:
      "An independent edition of landscape, observation and written features.",
    style: "Gazette",
    color: "#e8e1cd",
    image: "/media/forest.jpg",
  },
  kai: {
    name: "Kai Rowan",
    practice: "Photographer & filmmaker",
    description: "A wide sequence of places, interludes and moving images.",
    style: "Horizon",
    color: "#e5e8e8",
    image: "/media/sea.jpg",
  },
  ada: {
    name: "Ada Morel",
    practice: "Visual artist",
    description: "Large words, strong shapes and projects with presence.",
    style: "Poster",
    color: "#ecdf3e",
    image: "/media/form-red.svg",
  },
  common: {
    name: "Common Form",
    practice: "Independent art & design studio",
    description:
      "Projects, process and outcomes, with room for a studio voice.",
    style: "Atelier",
    color: "#e4e4df",
    image: "/media/form-blue.svg",
  },
  lina: {
    name: "Lina Moss",
    practice: "Writer & image-maker",
    description:
      "Essays, correspondence and photographs held at a reading pace.",
    style: "Journal",
    color: "#e8ddcd",
    image: "/media/lake.jpg",
  },
  remy: {
    name: "Rémy Sol",
    practice: "Artist & collector of fragments",
    description:
      "Images and words in an asymmetric, uncropped visual sequence.",
    style: "Montage",
    color: "#ece5dd",
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
export function createAdditionalSample(id: AdditionalSampleId): Site {
  const info = additionalSampleInfo[id],
    s = structuredClone(initialSite);
  s.name = info.name;
  s.tagline = info.practice;
  s.email = "";
  s.styleId = {
    elena: "gazette",
    kai: "horizon",
    ada: "poster",
    common: "atelier",
    lina: "journal",
    remy: "montage",
  }[id] as Site["styleId"];
  const homes = {
    elena: [
      "An ordinary world,\nseen anew.",
      "An independent edition of photographs and field observations.",
      "Issue 01 / Places & attention",
    ],
    kai: [
      "Distance is\na kind of time.",
      "Photographs, short films and notes collected between one place and the next.",
      "Sequences / 2024—2026",
    ],
    ada: [
      "Make room\nfor possibility.",
      "Images, objects and propositions for the spaces we share.",
      "Selected work / Ada Morel",
    ],
    common: [
      "Ideas become\nplaces to belong.",
      "An independent studio working across image, identity and the spaces in between.",
      "Practice / Selected projects",
    ],
    lina: [
      "Notes from\na slower day.",
      "Essays, photographs and letters about the ordinary things that ask us to stay.",
      "A small journal / Volume one",
    ],
    remy: [
      "Things found.\nConnections made.",
      "A collection of images and fragments, arranged through attention rather than certainty.",
      "Collected works / An open sequence",
    ],
  };
  const home = homes[id];
  let entries: Page[] = [];
  if (id === "elena")
    entries = [
      page(
        "canopy",
        "project",
        "Under the canopy",
        "A photographic essay on the light that remains below the treeline.",
        "Feature / Photographs",
        [
          media(
            "e1",
            "forest",
            "01 / A clearing held in green",
            "Sunlight threading through a dense green forest",
          ),
          text(
            "e2",
            "At first there is only green.\n\nStay a little longer and the canopy begins to separate into distances: the leaf nearest the hand, the branch beyond it, the light that may be a mile away.",
          ),
          media(
            "e3",
            "lake",
            "02 / A pause beside the water",
            "A cabin and mountains reflected in an alpine lake",
          ),
        ],
      ),
      page(
        "water",
        "project",
        "A surface, never still",
        "The sea as an unrepeatable record of a passing hour.",
        "Portfolio / Water",
        [
          media(
            "e4",
            "sea",
            "The same place, a different minute",
            "Blue waves under an open sky",
          ),
          text(
            "e5",
            "An image cannot hold the water still. It can only mark the moment when we were looking.",
          ),
        ],
      ),
      page(
        "editor-note",
        "writing",
        "The usefulness of looking",
        "A note on keeping an independent visual practice.",
        "From the editor",
        [
          text(
            "e6",
            "I keep this edition as a way to notice what changes.\n\nSome photographs arrive with a sentence. Others need a whole season before I know where to place them. The order is always an invitation to look again.",
          ),
        ],
        "Editor’s note",
      ),
    ];
  else if (id === "kai")
    entries = [
      page(
        "passing",
        "project",
        "A few seconds passing",
        "A sequence of photographs, a short original light study and a written pause.",
        "Sequence 01 / Image & film",
        [
          media(
            "k1",
            "sea",
            "01 / Arriving at the water",
            "An open sea with blue waves",
          ),
          text(
            "k2",
            "Nothing in this sequence is quite still.\nEven the photograph is a record of something leaving.",
          ),
          media(
            "k3",
            "studyFilm",
            "02 / A two-second study of changing light",
            "Original abstract light fade, two seconds",
            "video",
          ),
          media(
            "k4",
            "lake",
            "03 / Across the lake",
            "An alpine lake reflecting the surrounding mountains",
          ),
        ],
      ),
      page(
        "ridgeline",
        "project",
        "The long way around",
        "Location photographs for a film still taking shape.",
        "Sequence 02 / Landscape",
        [
          media(
            "k5",
            "mountain",
            "I / Before the path turns",
            "A steep mountain beneath pale cloud",
          ),
          media(
            "k6",
            "forest",
            "II / A darker room",
            "Sunbeams between deep green trees",
          ),
          text("k7", "Follow the edge until it becomes a place to begin."),
        ],
      ),
      page(
        "afterimage",
        "writing",
        "What stays after the frame",
        "A fragment about moving slowly.",
        "Notebook / 2026",
        [
          text(
            "k8",
            "The last image is rarely the one that stays.\n\nIt is the space between two images, the small effort of finding a relation, that I take home.",
          ),
        ],
        "Notebook",
      ),
    ];
  else if (id === "ada")
    entries = [
      page(
        "common-ground",
        "project",
        "Common ground",
        "Three propositions for seeing an ordinary room differently.",
        "Image / Colour / 2026",
        [
          media(
            "a1",
            "formRed",
            "A proposition in red",
            "Vermilion rectangle interrupted by an ivory arch",
          ),
          text(
            "a2",
            "A shape can be a question.\nA colour can be a place to meet.",
          ),
          media(
            "a3",
            "formBlue",
            "A space to hold the question",
            "Cobalt field with an ivory circle and a vermilion bar",
          ),
        ],
      ),
      page(
        "open-circle",
        "project",
        "An open circle",
        "Constructed images about the parts we leave unfinished.",
        "Constructed image / 2025",
        [
          media(
            "a4",
            "formYellow",
            "The room around the sun",
            "Yellow circle and cobalt rectangles on warm paper",
          ),
          text(
            "a5",
            "The work is complete when there is still room for someone else in it.",
          ),
        ],
      ),
      page(
        "propositions",
        "writing",
        "A small proposition",
        "A sentence for the studio wall.",
        "Words / Ongoing",
        [
          text(
            "a6",
            "Let the work be clear enough to enter,\nand open enough to change you.",
          ),
        ],
        "Words",
      ),
    ];
  else if (id === "common")
    entries = [
      page(
        "open-house",
        "project",
        "Open House",
        "A fictional identity study for a shared cultural space, from initial thought to visual language.",
        "Identity / Spatial thinking / 2026",
        [
          media(
            "c1",
            "formBlue",
            "01 / A common point of arrival",
            "Blue geometric composition with an ivory circle",
          ),
          text(
            "c2",
            "The brief\n\nMake an identity that behaves like an open door: recognisable, generous and easy to return to.\n\nThe approach\n\nA small family of forms becomes a flexible language for gatherings, printed matter and rooms.",
          ),
          media(
            "c3",
            "formYellow",
            "02 / A language that can grow",
            "Yellow sun and cobalt rectangles",
          ),
        ],
      ),
      page(
        "field-station",
        "project",
        "Field Station",
        "A visual notebook for a fictional place of observation and exchange.",
        "Art direction / Editorial / 2025",
        [
          media(
            "c4",
            "lake",
            "01 / Learning from the place",
            "An alpine lake and cabin",
          ),
          media(
            "c5",
            "forest",
            "02 / The surrounding rhythm",
            "Light falling through forest trees",
          ),
          text(
            "c6",
            "The project begins with attention to what is already there. We translate that rhythm into a system that can keep changing.",
          ),
        ],
      ),
      page(
        "working-notes",
        "writing",
        "How we begin",
        "A short account of the studio’s process.",
        "Practice notes",
        [
          text(
            "c7",
            "Listen first.\n\nWe begin by collecting questions, references and contradictions. The design grows from what the project needs to make possible, rather than a house style applied in advance.",
          ),
        ],
        "Process",
      ),
    ];
  else if (id === "lina")
    entries = [
      page(
        "a-chair",
        "writing",
        "A chair beside the window",
        "On returning to the same place and finding it altered.",
        "Essay / October 2026",
        [
          text(
            "l1",
            "The chair has not moved. The light has.\n\nFor several mornings I have been trying to separate those two facts. I sit in the same place with the same cup, but the room keeps finding another way to be itself.\n\nPerhaps this is what a daily practice offers: enough repetition to notice the difference.",
          ),
          media(
            "l2",
            "lake",
            "A place to return to",
            "Still alpine water beside a small cabin",
          ),
          text(
            "l3",
            "I am learning not to ask a place to be remarkable.\nOnly to be present long enough to see it.",
          ),
        ],
        "The window",
      ),
      page(
        "water-letter",
        "writing",
        "A letter from the water",
        "Notes written after a walk that took longer than intended.",
        "Letter / September 2026",
        [
          media(
            "l4",
            "sea",
            "The hour before coming home",
            "Sunlight above a blue sea",
          ),
          text(
            "l5",
            "Dear friend,\n\nI meant to walk for an hour. The water kept changing its mind about the colour of the sky, and I did not want to interrupt.\n\nI have nothing useful to report, except that it was good to be there.",
          ),
        ],
        "Letters",
      ),
      page(
        "green-book",
        "project",
        "The green notebook",
        "A small photographic companion to the written entries.",
        "Photographs / Ongoing",
        [
          media(
            "l6",
            "forest",
            "01 / An opening",
            "Sunlight in deep green forest",
          ),
          media(
            "l7",
            "mountain",
            "02 / An edge",
            "Mountain peak under a pale sky",
          ),
        ],
      ),
    ];
  else
    entries = [
      page(
        "loose-parts",
        "project",
        "Loose parts, held together",
        "A sequence assembled from landscape, colour and short fragments of writing.",
        "Collection 01 / Image & text",
        [
          media(
            "r1",
            "mountain",
            "A shape found at a distance",
            "Rocky mountain under pale cloud",
          ),
          media(
            "r2",
            "formRed",
            "A shape made in the studio",
            "Red rectangle with an ivory arch",
          ),
          text(
            "r3",
            "I put one image beside another.\nNot because they match, but because something begins to happen between them.",
          ),
          media(
            "r4",
            "sea",
            "Another way to describe a surface",
            "Blue waves on open water",
          ),
          media(
            "r5",
            "formYellow",
            "A sun for the table",
            "Yellow and cobalt geometric composition",
          ),
        ],
      ),
      page(
        "green-fragments",
        "project",
        "A pocket of green",
        "Observations from the edge of a landscape.",
        "Collection 02 / Photographs",
        [
          media(
            "r6",
            "forest",
            "01 / A borrowed room",
            "Forest filled with shafts of light",
          ),
          media(
            "r7",
            "lake",
            "02 / A reflection kept",
            "Mountains reflected in an alpine lake",
          ),
        ],
      ),
      page(
        "connecting",
        "writing",
        "On making a connection",
        "A note about collecting without concluding.",
        "Studio fragment",
        [
          text(
            "r8",
            "The collection is not an answer.\n\nIt is a way of keeping several questions in the same room long enough for them to become interesting to one another.",
          ),
        ],
        "Notes",
      ),
    ];
  s.pages = [
    page(
      "home",
      "home",
      home[0],
      home[1],
      home[2],
      [],
      id === "lina" ? "Entries" : "Work",
    ),
    ...entries,
    page(
      "about",
      "about",
      id === "common"
        ? "A practice of working together."
        : `About ${info.name}`,
      `${info.name} is a fictional identity created for this local design study.`,
      info.practice,
      [
        text(
          `${id}-about`,
          "This fictional studio demonstrates a distinct starting point for an artist website. All writing and geometric works are original demo material; landscape photographs are licensed demonstration images. The content, sequence, typography and page composition can be edited.",
        ),
      ],
      "About",
    ),
  ];
  s.publication = {
    title: info.name,
    description: home[1],
    language: "en",
    canonical: "",
  };
  const identity = s.appearances[s.styleId].identity;
  if (id === "ada")
    Object.assign(identity, {
      canvas: "#f1e76a",
      ink: "#24251d",
      accent: "#382e21",
      headingFont: "sans",
      weight: "700",
      tracking: -5,
    });
  if (id === "common")
    Object.assign(identity, {
      canvas: "#f1f1ec",
      ink: "#252d29",
      accent: "#31594d",
      headingFont: "sans",
      bodyFont: "sans",
      headingScale: 95,
    });
  if (id === "lina")
    Object.assign(identity, {
      canvas: "#f4ece1",
      ink: "#493b32",
      accent: "#634933",
      headingFont: "humanist",
      bodyFont: "serif",
      leading: 1.85,
    });
  if (id === "elena")
    Object.assign(identity, {
      canvas: "#f1eddf",
      ink: "#252c26",
      accent: "#42543b",
    });
  if (id === "kai")
    Object.assign(identity, {
      canvas: "#f2f3ef",
      ink: "#263039",
      accent: "#3d5867",
      headingFont: "sans",
    });
  if (id === "remy")
    Object.assign(identity, {
      canvas: "#f4efea",
      ink: "#41352f",
      accent: "#6c4936",
      headingFont: "humanist",
    });
  s.copy.eyebrow = "An independent practice";
  return siteSchema.parse(s);
}
