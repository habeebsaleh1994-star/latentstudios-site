import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openSite, type SiteDocument, type StoryPage } from "../src/studio/site";
import * as O from "../src/app/ops";

const site = (): SiteDocument => openSite(JSON.parse(readFileSync("design/samples/habib-saleh.site.json", "utf8")));
const st = (s: SiteDocument, id: string) => s.pages.find((p) => p.id === id) as StoryPage;
const works = (s: SiteDocument, id: string) => st(s, id).pieces.map((x) => (x.type === "work" ? (x.asset.match(/(\d+)\.jpg$/)?.[1] ?? x.asset.replace("asset:", "")) : "¶"));

describe("words", () => {
  it("sets site, front, page, piece and work fields; refuses unknown ones", () => {
    let s = site();
    s = O.setField(s, "site.name", "Nadia"); s = O.setField(s, "front.titleEm", "stone"); s = O.setField(s, "page:the-road-in.kicker", "Spring");
    s = O.setField(s, "piece:the-road-in:2.text", "Words."); s = O.setField(s, "work:/design/folio/img/12.jpg.title", "The road");
    s = O.setField(s, "page:about.para.1", "Second."); s = O.setField(s, "page:the-film.credits", "A\n\n B ");
    expect([s.name, s.front.titleEm, st(s, "the-road-in").kicker, (st(s, "the-road-in").pieces[2] as { text: string }).text, s.library["/design/folio/img/12.jpg"].title]).toEqual(["Nadia", "stone", "Spring", "Words.", "The road"]);
    expect((s.pages.find((p) => p.id === "the-film") as { credits: string[] }).credits).toEqual(["A", "B"]);
    expect(() => O.setField(s, "page:the-road-in.nope", "x")).toThrow();
    expect(() => O.setField(s, "piece:the-road-in:0.text", "x")).toThrow();
    expect(() => O.setField(s, "work:ghost.title", "x")).toThrow();
  });
  it("keeps line breaks and never leaves a work page untitled", () => {
    const s = O.setField(O.setField(site(), "page:the-door.para.0", "one\ntwo\n"), "page:the-door.title", "");
    expect((s.pages.find((p) => p.id === "the-door") as { paras: string[]; title: string }).paras[0]).toBe("one\ntwo");
    expect(s.pages.find((p) => p.id === "the-door")!.title).toBe("Untitled");
  });
});

describe("pages", () => {
  it("adds each kind with a unique address, work pages before the words pages", () => {
    let s = site();
    for (const k of ["story", "writing", "film", "project", "story"] as const) s = O.addPage(s, k).site;
    const ids = s.pages.map((p) => p.id);
    expect(ids.filter((i) => i.startsWith("new-story"))).toEqual(["new-story", "new-story-2"]);
    expect(ids.slice(-2)).toEqual(["about", "contact"]);
  });
  it("moves, hides, renames and removes", () => {
    let s = O.movePage(site(), "he-looked-back", -1);
    expect(s.pages[0].id).toBe("he-looked-back");
    expect(O.movePage(s, "he-looked-back", -1)).toBe(s);
    s = O.toggleNav(s, "the-road-in"); expect(s.pages.find((p) => p.id === "the-road-in")!.inNav).toBe(false);
    const r = O.renamePage(s, "the-road-in", "The road in"); expect(r.id).toBe("the-road-in");
    const r2 = O.renamePage(s, "the-road-in", "Late light"); expect(r2.id).toBe("late-light-2");
    s = O.removePage(s, "the-film"); expect(s.pages.some((p) => p.id === "the-film")).toBe(false);
  });
  it("sets the front form, an arrangement and the theme within its choices", () => {
    let s = O.setFront(site(), "list"); s = O.setArrangement(s, "the-road-in", "book"); s = O.setTheme(s, { look: "toned", accent: "#2F6FEB" });
    expect([s.front.form, st(s, "the-road-in").arrangement, s.theme.look, s.theme.accent]).toEqual(["list", "book", "toned", "#2F6FEB"]);
    expect(() => O.setTheme(s, { look: "neon" as never })).toThrow();
  });
});

describe("a story's works", () => {
  it("adds from the library after a given piece, and refuses works the library lacks", () => {
    const s = O.addWorks(site(), "afternoon", 0, ["/design/folio/img/9.jpg"]);
    expect(works(s, "afternoon")).toEqual(["1", "9", "6"]);
    expect(() => O.addWorks(site(), "afternoon", 0, ["ghost"])).toThrow();
  });
  it("a pair with no work after it is let go; a pause in between keeps the choice but shows no pair", () => {
    let s = site(); // he-looked-back: 5, 3 (with next), 4
    s = O.removePiece(s, "he-looked-back", 2);
    expect((st(s, "he-looked-back").pieces[1] as { arrange: string }).arrange).toBe("alone");
    // a pause between a pair keeps the artist's choice (a wall can still show it), but the page no longer pairs them
    s = O.addPause(site(), "he-looked-back", 1);
    expect(O.arrangeOptions(s, "he-looked-back", 1).find((o) => o.current)!.key).toBe("alone");
  });
  it("offers only what will happen: no pair for a portrait, a note only for a portrait", () => {
    const s = site(), pine = O.arrangeOptions(s, "the-road-in", 1).map((o) => o.key); // 8.jpg is a portrait
    expect(pine).toContain("margin-note"); expect(pine).not.toContain("with-next");
    const road = O.arrangeOptions(s, "the-road-in", 0).map((o) => o.key);
    expect(road).not.toContain("margin-note");
    expect(O.arrangeOptions(s, "he-looked-back", 1).find((o) => o.current)!.key).toBe("with-next");
  });
  it("each arrangement offers only what it shows: wall hangs or ends a wall, contact offers nothing, slides a line, book a spread", () => {
    const s = site(), withA = (a: string) => ({ ...s, pages: s.pages.map((p) => (p.id === "the-road-in" ? { ...p, arrangement: a } : p)) }) as typeof s;
    const as = (a: string) => O.arrangeOptions(withA(a), "the-road-in", 1).map((o) => o.key);
    expect(as("wall")).toEqual(["with-next", "alone"]);
    expect(as("contact")).toEqual([]);
    expect(as("slides")).toEqual(["alone", "margin-note"]);
    expect(as("held")).toEqual(["alone", "margin-note", "full"]);
    expect(as("passage")).not.toContain("full");
    expect(O.arrangeOptions(withA("book"), "the-road-in", 0).find((o) => o.key === "full")!.title).toBe("Across both pages");
    // the last work on a wall has nothing to choose
    expect(O.arrangeOptions(withA("wall"), "the-road-in", 3)).toEqual([]);
  });

  it("arranges: pair with the previous, full undoes a pair, a note replaces a pair", () => {
    let s = O.arrange(site(), "through-the-gate", 0, "with-next"); // 10 with 7, then 7 had with-next to 11
    expect(st(s, "through-the-gate").pieces.map((x) => (x as { arrange: string }).arrange)).toEqual(["with-next", "with-next", "alone"]);
    s = O.arrange(s, "through-the-gate", 1, "full");
    expect(st(s, "through-the-gate").pieces.map((x) => [(x as { arrange: string }).arrange, (x as { full: boolean }).full])).toEqual([["alone", false], ["alone", true], ["alone", false]]);
    s = O.arrange(s, "through-the-gate", 2, "with-prev");
    expect(st(s, "through-the-gate").pieces.map((x) => [(x as { arrange: string }).arrange, (x as { full: boolean }).full])).toEqual([["alone", false], ["with-next", false], ["alone", false]]);
  });
  it("moves a work to another story or a new one; the photograph stays one library entry", () => {
    let r = O.moveTo(site(), "late-light", 0, "afternoon");
    expect(works(r.site, "late-light")).toEqual(["6", "7"]); expect(works(r.site, "afternoon")).toEqual(["1", "6", "9"]);
    r = O.moveTo(r.site, "late-light", 0, "new");
    expect(r.to).toBe("new-story"); expect(works(r.site, "new-story")).toEqual(["6"]);
    expect(Object.keys(r.site.library).length).toBe(Object.keys(site().library).length);
  });
});

describe("the trash", () => {
  it("a removed page waits in the trash and comes back whole, at the end of its kind", () => {
    const s = O.removePage(site(), "he-looked-back");
    expect(s.pages.some((p) => p.id === "he-looked-back")).toBe(false);
    expect(s.trash[0].page.id).toBe("he-looked-back");
    expect(O.unused(s)).toEqual([]); // its works stay in the library
    const r = O.restorePage(s, "he-looked-back");
    expect(r.lost).toBe(0);
    const ids = r.site.pages.map((p) => p.id);
    expect(ids.indexOf("he-looked-back")).toBe(ids.indexOf("the-door") + 1); // after the last piece of work, before About
    expect(r.site.trash.length).toBe(0);
  });
  it("comes back without a work that was deleted meanwhile, and under a free address", () => {
    let s = O.removePage(site(), "late-light");
    s = { ...s, library: Object.fromEntries(Object.entries(s.library).filter(([a]) => a !== "/design/folio/img/9.jpg")), pages: s.pages.map((p) => p.kind === "story" ? { ...p, pieces: p.pieces.filter((x) => x.type !== "work" || x.asset !== "/design/folio/img/9.jpg") } : p.kind === "writing" ? { ...p, image: null } : p) } as typeof s;
    s = O.addPage(s, "story", "Late light").site;
    const r = O.restorePage(s, "late-light");
    expect(r.lost).toBe(1); expect(r.id).toBe("late-light-2");
    expect(() => O.restorePage(r.site, "late-light")).toThrow();
  });
  it("is emptied, one page or all, and expires after thirty days", () => {
    let s = O.removePage(O.removePage(site(), "the-door"), "about");
    expect(O.emptyTrash(s, "the-door").trash.map((t) => t.page.id)).toEqual(["about"]);
    expect(O.emptyTrash(s).trash).toEqual([]);
    s = { ...s, trash: s.trash.map((t, i) => ({ ...t, removedAt: new Date(Date.now() - (i ? 31 : 2) * 86400000).toISOString() })) };
    expect(O.expireTrash(s).trash.map((t) => t.page.id)).toEqual(["about"]);
    expect(O.conform(s).trash.length).toBe(1);
  });
});

describe("templates", () => {
  it("applying a template changes the skeleton, look, type and front, and never the content", () => {
    const a = site();
    for (const h of ["gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern", "folio"] as const) {
      const b = O.applyHouse(a, h).site;
      expect(b.house).toBe(h);
      // the content is untouched; only a story's arrangement may change, to one the template offers
      const strip = (s: typeof a) => s.pages.map((p) => (p.kind === "story" ? { ...p, arrangement: "" } : p));
      expect(JSON.stringify([strip(b), b.library, b.name, b.front.title, b.front.note])).toBe(JSON.stringify([strip(a), a.library, a.name, a.front.title, a.front.note]));
    }
    const g = O.applyHouse(a, "gallery").site;
    expect([g.theme.header, g.theme.opening, g.theme.look, g.front.form]).toEqual(["name", "work", "gallery", "sheet"]);
    expect(O.addPage(O.applyHouse(a, "monograph").site, "story").site.pages.find((p) => p.id === "new-story")!.kind === "story" && (O.addPage(O.applyHouse(a, "monograph").site, "story").site.pages.find((p) => p.id === "new-story") as StoryPage).arrangement).toBe("book");
  });
  it("a template refuses what it does not offer, and keeps the rest: Gallery has no side column and no book; Monograph only books", () => {
    const g = O.applyHouse(site(), "gallery").site;
    expect(() => O.setTheme(g, { header: "rail" })).toThrow(/does not offer/);
    expect(() => O.setArrangement(g, "the-road-in", "book")).toThrow(/does not offer/);
    expect(() => O.setTheme(g, { look: "swiss" })).toThrow(/does not offer/);
    expect(O.setTheme(g, { captions: "under", typeface: "jost" }).theme.captions).toBe("under");
    const m = O.applyHouse(site(), "monograph");
    expect(new Set(m.site.pages.flatMap((p) => (p.kind === "story" ? [p.arrangement] : [])))).toEqual(new Set(["book"]));
    expect(m.rearranged.length).toBeGreaterThan(0);
  });
  it("opening a site brings it within its template", () => {
    const s = site(), off = { ...s, theme: { ...s.theme, header: "rail" as const, look: "swiss" as const } };
    const c = O.conform(off);
    expect([c.theme.header, c.theme.look]).toEqual(["classic", "quiet"]);
  });
  it("no two templates share a skeleton", () => {
    const keys = ["look", "typeface", "header", "opening", "title", "captions", "footer", "scale"] as const;
    const sigs = ["folio", "gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern"].map((h) => { const t = O.applyHouse(site(), h as never).site.theme; return keys.map((k) => t[k]).join("|"); });
    expect(new Set(sigs).size).toBe(sigs.length);
    const skeletons = ["folio", "gallery", "monograph", "passage", "reel", "salon", "index", "atelier", "lantern"].map((h) => { const t = O.applyHouse(site(), h as never).site.theme; return [t.header, t.opening, t.title, t.captions, t.footer].join("|"); });
    expect(new Set(skeletons).size).toBe(skeletons.length);
  });
});

describe("library, films, projects, writing", () => {
  it("a new photograph takes an old one's place everywhere, keeping its words", () => {
    const old = "/design/folio/img/6.jpg"; // in two stories
    let s = O.setField(site(), `work:${old}.title`, "Under the leaves, 2025");
    s = O.replaceWork(s, old, "asset:new", { w: 3000, h: 2000 });
    expect(s.library[old]).toBeUndefined();
    expect(s.library["asset:new"]).toMatchObject({ title: "Under the leaves, 2025", w: 3000, h: 2000 });
    expect(s.pages.filter((p) => p.kind === "story" && p.pieces.some((x) => x.type === "work" && x.asset === "asset:new")).length).toBe(2);
    expect(JSON.stringify(s)).not.toContain(old);
    expect(() => O.replaceWork(s, "ghost", "asset:x", { w: 1, h: 1 })).toThrow();
  });
  it("a folder becomes a story, with what the files said", () => {
    let s = O.addToLibrary(site(), "asset:a", { w: 3000, h: 2000, title: "Stray cat", caption: "A cat in Joun.", date: "10 Nov 2025" });
    s = O.addToLibrary(s, "asset:b", { w: 2000, h: 3000, title: "The pine" });
    const r = O.storyFromWorks(s, "Joun, autumn", ["asset:a", "asset:b"]);
    expect(r.id).toBe("joun-autumn");
    expect(works(r.site, r.id)).toEqual(["asset:a", "asset:b"].map((a) => a.replace("asset:", "")).map((x) => x));
    expect(r.site.library["asset:a"]).toMatchObject({ caption: "A cat in Joun.", alt: "A cat in Joun.", date: "10 Nov 2025" });
    expect(r.site.library["asset:b"].alt).toBe("The pine");
  });
  it("adds a work, tells which are unused, and removes only unused ones", () => {
    let s = O.addToLibrary(site(), "asset:x", { w: 3000, h: 2000, title: "New" });
    expect(O.unused(s)).toEqual(["asset:x"]);
    expect(() => O.removeFromLibrary(s, "/design/folio/img/12.jpg")).toThrow(/still on a page/);
    s = O.removeFromLibrary(s, "asset:x"); expect(s.library["asset:x"]).toBeUndefined();
  });
  it("film stills and project lists add, move and remove; compare turns off without both sides", () => {
    let s = O.addToList(site(), "the-film", "stills", ["/design/folio/img/1.jpg"]);
    const n = (s.pages.find((p) => p.id === "the-film") as { stills: unknown[] }).stills.length;
    s = O.moveInList(s, "the-film", "stills", n - 1, -1); s = O.removeFromList(s, "the-film", "stills", 0);
    expect((s.pages.find((p) => p.id === "the-film") as { stills: unknown[] }).stills.length).toBe(n - 1);
    s = O.addPage(s, "project").site; s = O.addToList(s, "a-new-project", "outcome", ["/design/folio/img/1.jpg"]); s = O.addToList(s, "a-new-project", "process", ["/design/folio/img/2.jpg"]);
    s = O.setCompare(s, "a-new-project", true); expect((s.pages.find((p) => p.id === "a-new-project") as { compare: boolean }).compare).toBe(true);
    s = O.removeFromList(s, "a-new-project", "process", 0); expect((s.pages.find((p) => p.id === "a-new-project") as { compare: boolean }).compare).toBe(false);
  });
  it("writing image and paragraphs", () => {
    let s = O.setWritingImage(site(), "the-door", null); expect((s.pages.find((p) => p.id === "the-door") as { image: unknown }).image).toBeNull();
    s = O.addPara(s, "about"); s = O.removePara(s, "about", 0);
    expect((s.pages.find((p) => p.id === "about") as { paras: string[] }).paras.length).toBe(2);
  });
  it("every operation returns a new site and leaves the old one untouched", () => {
    const a = site(), before = JSON.stringify(a);
    O.arrange(a, "the-road-in", 0, "full"); O.setField(a, "site.name", "X"); O.moveTo(a, "late-light", 0, "new"); O.removePage(a, "about");
    expect(JSON.stringify(a)).toBe(before);
  });
});
