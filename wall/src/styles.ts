import type { Site } from "./model";
export type StyleDirection = {
  id: string;
  name: string;
  status: "available" | "planned";
  composition: string;
  navigation: string;
};
export const availableDirections: Array<
  StyleDirection & { id: Site["styleId"]; short: string }
> = [
  {
    id: "folio",
    name: "Folio",
    status: "available",
    short: "An editorial unfolding",
    composition: "Photographs and words, in a carefully paced vertical essay.",
    navigation: "Quiet top navigation and next-project links",
  },
  {
    id: "gallery",
    name: "Gallery",
    status: "available",
    short: "Space around every work",
    composition:
      "A spacious exhibition wall. Step into a project and move from work to work.",
    navigation: "Side navigation, exhibition rooms, and a contact strip",
  },
  {
    id: "cinema",
    name: "Cinema",
    status: "available",
    short: "Enter the screening room",
    composition:
      "An immersive cover and a sequence of images, films, and interludes.",
    navigation: "Programme, scenes, and deliberate next/previous controls",
  },
  {
    id: "archive",
    name: "Archive",
    status: "available",
    short: "A living index",
    composition:
      "A searchable catalogue, dense contact sheets, and close views of individual works.",
    navigation: "Filtered index and entry-by-entry lightbox",
  },
  {
    id: "gazette",
    name: "Gazette",
    status: "available",
    short: "An independent magazine",
    composition: "A lead story, an edition index and column-based features.",
    navigation: "Masthead, contents and continuing features",
  },
  {
    id: "horizon",
    name: "Horizon",
    status: "available",
    short: "A sequence across the room",
    composition:
      "A horizontal desktop filmstrip becomes a complete vertical sequence on mobile.",
    navigation: "Scrollable rail with keyboard and previous/next controls",
  },
  {
    id: "poster",
    name: "Poster",
    status: "available",
    short: "Words with presence",
    composition:
      "Large typographic billboards and full-width project chapters.",
    navigation: "Numbered project billboards and chapter links",
  },
  {
    id: "atelier",
    name: "Atelier",
    status: "available",
    short: "Practice, process, outcome",
    composition:
      "A studio index and split case studies with a persistent introduction.",
    navigation: "Project rows, case-study reading and next project",
  },
  {
    id: "journal",
    name: "Journal",
    status: "available",
    short: "A place to read slowly",
    composition:
      "Intimate entries with marginal notes and generous book-like reading.",
    navigation: "Authored entries and continuing essays",
  },
  {
    id: "montage",
    name: "Montage",
    status: "available",
    short: "A collection in conversation",
    composition:
      "Staggered, uncropped visual compositions with a clear linear reading order.",
    navigation: "Asymmetric project board and flowing media sequences",
  },
];
export const styleDirections: StyleDirection[] = availableDirections;
