import { describe, it, expect } from "vitest";
import { studioSchema, toSalonContent, fromSalonContent, DEFAULT_LONG_EDGE_CM, type StudioDocument, type RoomAsset } from "../src/studio/document";

const dims: Record<string, RoomAsset> = { a: { src: "/a", w: 3000, h: 2000 }, b: { src: "/b", w: 2000, h: 3000 }, c: { src: "/c", w: 2000, h: 2000 } };
const asset = (id: string) => dims[id.replace("img/", "")];
const img = (id: string, extra: object = {}) => ({ id, type: "image", assetId: `img/${id}`, title: `Work ${id}`, date: "2025", caption: "Oil on linen", alt: `Alt ${id}`, ...extra });
const doc = (): StudioDocument => studioSchema.parse({
  version: 14, room: "folio", name: "Sora Vale", tagline: "hello@example.com", email: "",
  theme: { palette: "silk", mode: "system", accent: "#B87B8A", type: "silk", mount: "bare", space: "standard", motion: "slow", read: "standard" },
  pages: [
    { id: "works", kind: "project", title: "Light in | small rooms", label: "Works", subtitle: "A note.", meta: "Paintings, 2022 to 2026", inNav: true,
      blocks: [img("a", { arrange: "with-next", size: { w: 150, h: 100 } }), img("b", { arrange: "with-next" }), img("c")] },
    { id: "about", kind: "about", title: "About", label: "About", subtitle: "", meta: "", inNav: true, blocks: [{ id: "t", type: "text", assetId: "", text: "Sora paints." }] },
  ],
});

describe("salon <-> document", () => {
  it("reads works with real sizes, mediums and the hang", () => {
    const c = toSalonContent(doc(), "works", asset);
    expect(c.blocks).toEqual([{ type: "work", work: "a", hang: "with" }, { type: "work", work: "b", hang: "with" }, { type: "work", work: "c", hang: "alone" }]);
    expect(c.works.a).toMatchObject({ title: "Work a", medium: "Oil on linen", cmW: 150, cmH: 100 });
    expect(c.site).toMatchObject({ title: "Light in", titleEm: "small rooms", kicker: "Paintings, 2022 to 2026", about: ["Sora paints."] });
  });

  it("assumes 60 cm on the long edge, keeping proportions, when no size is given", () => {
    const c = toSalonContent(doc(), "works", asset);
    expect(c.works.b.cmW).toBe(40);
    expect(c.works.b.cmH).toBe(DEFAULT_LONG_EDGE_CM);
    expect(c.works.c).toMatchObject({ cmW: 60, cmH: 60 });
  });

  it("a hang that runs off the end of the page is treated as alone", () => {
    const d = doc(); d.pages[0].blocks[2].arrange = "with-next";
    expect(toSalonContent(d, "works", asset).blocks[2].hang).toBe("alone");
  });

  it("writing it back keeps titles, sizes and the hang", () => {
    const d = doc(), back = fromSalonContent(d, "works", toSalonContent(d, "works", asset));
    const view = (x: StudioDocument) => x.pages[0].blocks.map((b) => [b.id, b.title, b.date, b.caption, b.size, b.arrange === "with-next"]);
    expect(view(back).map((r) => r.slice(0, 4))).toEqual(view(d).map((r) => r.slice(0, 4)));
    expect(back.pages[0].blocks[0].size).toEqual({ w: 150, h: 100 });
    expect(back.pages[0].blocks.map((b) => b.arrange)).toEqual(["with-next", "with-next", "alone"]);
  });

  it("an edit lands in the document: resize, change the hang, add and remove", () => {
    const d = doc(), c = toSalonContent(d, "works", asset);
    c.works.c.cmW = 200; c.works.c.cmH = 200;
    c.blocks[1].hang = "alone";
    c.works.n1 = { assetId: "asset:abc", src: "blob:x", w: 1200, h: 800, title: "Untitled", date: "2026", medium: "", alt: "Untitled", cmW: 60, cmH: 40 };
    c.blocks.push({ type: "work", work: "n1", hang: "alone" });
    delete c.works.a; c.blocks = c.blocks.filter((b) => b.work !== "a");
    const back = fromSalonContent(d, "works", c);
    const bl = back.pages[0].blocks;
    expect(bl.map((b) => b.id)).toEqual(["b", "c", "n1"]);
    expect(bl[1].size).toEqual({ w: 200, h: 200 });
    expect(bl[0].arrange).toBe("alone");
    expect(bl[2].assetId).toBe("asset:abc");
  });

  it("refuses a size that is not a sensible number of centimetres", () => {
    const d = doc(), c = toSalonContent(d, "works", asset);
    c.works.a.cmW = 0;
    expect(() => fromSalonContent(d, "works", c)).toThrow();
    c.works.a.cmW = 5000;
    expect(() => fromSalonContent(d, "works", c)).toThrow();
  });

  it("refuses a hang that points at a work it does not contain, and a missing page", () => {
    const d = doc(), c = toSalonContent(d, "works", asset);
    c.blocks.push({ type: "work", work: "ghost", hang: "alone" });
    expect(() => fromSalonContent(d, "works", c)).toThrow(/ghost/);
    expect(() => toSalonContent(d, "nope", asset)).toThrow(/No page/);
  });
});
