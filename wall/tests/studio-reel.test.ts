import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { openDB } from "idb";
import { studioSchema, toReelContent, fromReelContent, ratioNumber, type StudioDocument, type RoomAsset } from "../src/studio/document";
import { createStudioStore, type RoomsDB } from "../src/studio/store";

const asset = (id: string): RoomAsset => ({ src: `/${id}`, w: 1500, h: 1000 });
const img = (id: string, extra: object = {}) => ({ id, type: "image", assetId: `img/${id}`, title: `Still ${id}`, alt: `Alt ${id}`, ...extra });
const txt = (id: string, t: string) => ({ id, type: "text", assetId: "", text: t });
const doc = (): StudioDocument => studioSchema.parse({
  version: 14, room: "reel", name: "Ivo Sen", tagline: "hello@example.com", email: "",
  theme: { palette: "night", mode: "dark", accent: "#B87B8A", type: "silk", mount: "bare", space: "standard", motion: "slow", read: "standard" },
  pages: [
    { id: "home", kind: "home", title: "Made in | the dark", label: "Films", subtitle: "A note.", meta: "Short films", inNav: true, blocks: [] },
    { id: "f1", kind: "project", title: "Before it disappears", label: "Short film", subtitle: "Villages in the hills.", meta: "2025 · 12 min · 2.39:1", inNav: true,
      blocks: [img("p1"), { id: "v1", type: "video", assetId: "media/f1.mp4", note: "https://example.com/f1" }, img("s1"), img("s2"), txt("c1", "Directed by Ivo Sen"), txt("c2", "Photography by Noor Rahal")] },
    { id: "f2", kind: "project", title: "Salt", label: "Documentary", subtitle: "", meta: "2024 · 8 min · 16:9", inNav: true, blocks: [img("p2"), { id: "v2", type: "video", assetId: "", note: "https://vimeo.com/x" }] },
    { id: "about", kind: "about", title: "About", label: "About", subtitle: "", meta: "", inNav: true, blocks: [txt("a", "Ivo films.")] },
  ],
});

describe("reel <-> document", () => {
  it("reads films: poster, video, link, stills, credits, year, runtime and ratio", () => {
    const c = toReelContent(doc(), asset);
    expect(c.films.map((f) => f.id)).toEqual(["f1", "f2"]);
    const [a, b] = c.films;
    expect(a).toMatchObject({ title: "Before it disappears", form: "Short film", year: "2025", runtime: "12 min", ratio: "2.39:1", synopsis: "Villages in the hills.", link: "https://example.com/f1" });
    expect(a.poster?.assetId).toBe("img/p1");
    expect(a.video?.assetId).toBe("media/f1.mp4");
    expect(a.stills.map((s) => s.assetId)).toEqual(["img/s1", "img/s2"]);
    expect(a.credits).toEqual(["Directed by Ivo Sen", "Photography by Noor Rahal"]);
    expect(b.video).toBeNull();
    expect(b.link).toBe("https://vimeo.com/x");
    expect(c.site).toMatchObject({ title: "Made in", titleEm: "the dark", kicker: "Short films", about: ["Ivo films."] });
  });

  it("writing it straight back changes nothing that matters", () => {
    const d = doc(), back = fromReelContent(d, toReelContent(d, asset));
    const view = (x: StudioDocument) => x.pages.filter((p) => p.kind === "project").map((p) => [p.id, p.title, p.label, p.meta, p.subtitle, p.blocks.map((b) => [b.type, b.assetId, b.title, b.text, b.note])]);
    expect(view(back)).toEqual(view(d));
    expect(back.pages.map((p) => p.kind)).toEqual(["home", "project", "project", "about"]);
  });

  it("an edit lands in the document: new film, retitle, drop the video but keep the link, add a still", () => {
    const d = doc(), c = toReelContent(d, asset);
    c.films.push({ id: "n1", title: "Untitled", form: "Short film", year: "2026", runtime: "", ratio: "16:9", synopsis: "", credits: [], link: "", poster: null, video: null, stills: [] });
    c.films[0].title = "Renamed"; c.films[0].video = null;
    c.films[0].stills.push({ assetId: "asset:abc", src: "blob:x", w: 900, h: 600, alt: "New", caption: "New still" });
    const back = fromReelContent(d, c);
    const f1 = back.pages.find((p) => p.id === "f1")!;
    expect(f1.title).toBe("Renamed");
    expect(f1.blocks.find((b) => b.type === "video")).toMatchObject({ assetId: "", note: "https://example.com/f1" });
    expect(f1.blocks.filter((b) => b.type === "image")).toHaveLength(4);
    expect(back.pages.map((p) => p.id)).toEqual(["home", "f1", "f2", "n1", "about"]);
  });

  it("turns a ratio written the usual ways into a number, and falls back to 16:9", () => {
    expect(ratioNumber("2.39:1")).toBeCloseTo(2.39);
    expect(ratioNumber("16:9")).toBeCloseTo(1.7778);
    expect(ratioNumber("4:3")).toBeCloseTo(1.3333);
    expect(ratioNumber("1.85")).toBeCloseTo(1.85);
    expect(ratioNumber("")).toBeCloseTo(1.7778);
    expect(ratioNumber("wide")).toBeCloseTo(1.7778);
    expect(ratioNumber("0:0")).toBeCloseTo(1.7778);
  });
});

describe("films in the store", () => {
  const fresh = () => { const name = `reel-${Math.random()}`; return createStudioStore(() => openDB<RoomsDB>(name, 1, { upgrade(db) { db.createObjectStore("documents"); db.createObjectStore("assets"); } })); };
  it("keeps an MP4 or WebM as bytes and reads it back as a film", async () => {
    const s = fresh();
    const id = await s.putVideo(new Blob([new Uint8Array(64)], { type: "video/mp4" }));
    const back = await s.readImage(id);
    expect(back?.size).toBe(64);
    expect(back?.type).toBe("video/mp4");
  });
  it("refuses other kinds of file and films that are too large", async () => {
    const s = fresh();
    await expect(s.putVideo(new Blob(["x"], { type: "image/jpeg" }))).rejects.toThrow(/MP4/);
    await expect(s.putVideo(new Blob([new Uint8Array(81 * 1024 * 1024)], { type: "video/mp4" }))).rejects.toThrow(/80 MB/);
  });
});
