import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { siteSchema, openSite, assetsOf, usesOf, photographCount, type SiteDocument, type StoryPage } from "../src/studio/site";

const SEEDS = ["folio", "index", "salon", "reel", "atelier", "lantern"];
const seed = (t: string): SiteDocument => { const f = readdirSync(`design/${t}/doc`).find((x) => x.endsWith(".site.json"))!; return openSite(JSON.parse(readFileSync(`design/${t}/doc/${f}`, "utf8"))); };
const story = (s: SiteDocument) => s.pages.find((p) => p.kind === "story") as StoryPage;

describe("site document v15", () => {
  for (const t of SEEDS) it(`${t}: the sample site opens and every work in its library is placed`, () => {
    const s = seed(t);
    expect(new Set(s.pages.flatMap(assetsOf))).toEqual(new Set(Object.keys(s.library)));
  });

  it("the samples carry each kind: stories with arrangements, writing, films, projects", () => {
    expect(story(seed("folio")).arrangement).toBe("held");
    expect(story(seed("salon")).arrangement).toBe("wall");
    expect(story(seed("lantern")).arrangement).toBe("slides");
    expect(seed("index").pages.filter((p) => p.kind === "writing").length).toBe(6);
    expect(seed("reel").pages.filter((p) => p.kind === "film").length).toBe(3);
    expect(seed("atelier").pages.filter((p) => p.kind === "project").length).toBe(3);
  });

  it("one site can hold every kind: the mixed sample has stories in each arrangement its template offers, a film, writing, about and contact", () => {
    const s = openSite(JSON.parse(readFileSync("design/samples/habib-saleh.site.json", "utf8")));
    expect(new Set(s.pages.map((p) => p.kind))).toEqual(new Set(["story", "film", "writing", "about", "contact"]));
    expect(new Set(s.pages.flatMap((p) => (p.kind === "story" ? [p.arrangement] : [])))).toEqual(new Set(["held", "book", "contact"]));
  });

  it("refuses two pages at one address", () => {
    const s = seed("folio");
    expect(siteSchema.safeParse({ ...s, pages: [...s.pages, { ...s.pages[0] }] }).success).toBe(false);
  });
  it("refuses a page that refers to a work the library does not have", () => {
    const s = seed("folio"), st = story(s);
    expect(siteSchema.safeParse({ ...s, pages: s.pages.map((p) => (p.id === st.id ? { ...st, pieces: [...st.pieces, { type: "work", asset: "ghost.jpg" }] } : p)) }).success).toBe(false);
  });
  it("never stores geometry on a piece", () => {
    const s = seed("folio"), st = story(s), w = st.pieces.find((x) => x.type === "work")!;
    expect(siteSchema.safeParse({ ...s, pages: s.pages.map((p) => (p.id === st.id ? { ...st, pieces: [{ ...w, x: 10 }] } : p)) }).success).toBe(false);
  });
  it("one photograph in two stories: one library entry, counted once, used by both", () => {
    const s = seed("folio"), st = story(s), a = (st.pieces.find((x) => x.type === "work") as { asset: string }).asset;
    const two = siteSchema.parse({ ...s, pages: [...s.pages, { id: "again", kind: "story", title: "Again", pieces: [{ type: "work", asset: a }] }] });
    expect(usesOf(two, a)).toEqual([st.id, "again"]);
    expect(photographCount(two)).toBe(photographCount(s));
  });
  it("opens only version 15", () => {
    expect(() => openSite({ version: 14 })).toThrow(/cannot open/);
  });
});
