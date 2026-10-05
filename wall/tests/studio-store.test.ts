import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { openDB } from "idb";
import { createStudioStore, StaleRevisionError, isStoredAsset, type RoomsDB } from "../src/studio/store";
import { studioSchema, toFolioContent, fromFolioContent, type StudioDocument, type RoomAsset } from "../src/studio/document";

let n = 0;
const fresh = () => {
  const name = `studio-test-${++n}-${Math.random()}`;
  return createStudioStore(() => openDB<RoomsDB>(name, 1, { upgrade(db) { db.createObjectStore("documents"); db.createObjectStore("assets"); } }));
};
const img = (id: string, extra: object = {}) => ({ id, type: "image", assetId: `img/${id}.jpg`, title: `Title ${id}`, date: "1 Jan 2025", alt: `Alt ${id}`, ...extra });
const seed = (): unknown => ({
  version: 14, room: "folio", name: "Habib Saleh", tagline: "hello@example.com", email: "",
  theme: { palette: "silk", mode: "system", accent: "#B87B8A", type: "silk", mount: "bare", space: "standard", motion: "slow", read: "standard" },
  pages: [
    { id: "series", kind: "project", title: "Before it disappears", label: "Series", subtitle: "A note.", meta: "Lebanon", inNav: true,
      blocks: [img("a"), img("b", { arrange: "with-next" }), img("c"), { id: "p1", type: "text", assetId: "", role: "pause", title: "From the series", text: "Most of it is not rare." }, img("d", { arrange: "margin-note", note: "A pine." })] },
    { id: "about", kind: "about", title: "About", label: "About", subtitle: "", meta: "", inNav: true, blocks: [{ id: "t", type: "text", assetId: "", text: "Hello." }] },
  ],
});
const dims = (id: string): RoomAsset => ({ src: `/${id}`, w: id.includes("d") ? 1000 : 1500, h: id.includes("d") ? 1500 : 1000 });
const photo = (type = "image/jpeg", size = 10) => new Blob([new Uint8Array(size)], { type });

describe("studio store", () => {
  it("seeds on first load and returns the stored document afterwards", async () => {
    const s = fresh();
    const first = await s.load(seed(), "t");
    expect(first.seeded).toBe(true);
    expect(first.revision).toBe(1);
    const second = await s.load({ nonsense: true }, "t");
    expect(second.seeded).toBe(false);
    expect(second.doc.name).toBe("Habib Saleh");
  });

  it("saves a new revision and persists the change", async () => {
    const s = fresh();
    const { doc, revision } = await s.load(seed(), "t");
    const next = await s.save({ ...doc, name: "H. Saleh" }, revision, "t");
    expect(next).toBe(revision + 1);
    expect((await s.load(seed(), "t")).doc.name).toBe("H. Saleh");
  });

  it("refuses a save based on an old revision instead of overwriting", async () => {
    const s = fresh();
    const { doc, revision } = await s.load(seed(), "t");
    await s.save({ ...doc, name: "Tab A" }, revision, "t");
    await expect(s.save({ ...doc, name: "Tab B" }, revision, "t")).rejects.toBeInstanceOf(StaleRevisionError);
    expect((await s.load(seed(), "t")).doc.name).toBe("Tab A");
  });

  it("refuses an invalid document", async () => {
    const s = fresh();
    const { doc, revision } = await s.load(seed(), "t");
    await expect(s.save({ ...doc, theme: { ...doc.theme, palette: "neon" } } as unknown as StudioDocument, revision, "t")).rejects.toThrow();
  });

  it("stores and reads images, and only accepts image files within the size limit", async () => {
    const s = fresh();
    const id = await s.putImage(photo());
    expect(isStoredAsset(id)).toBe(true);
    expect((await s.readImage(id))?.size).toBe(10);
    expect(await s.readImage("img/static.jpg")).toBeUndefined();
    await expect(s.putImage(photo("application/pdf"))).rejects.toThrow(/JPG/);
    await expect(s.putImage(photo("image/jpeg", 31 * 1024 * 1024))).rejects.toThrow(/30 MB/);
  });

  it("still reads an image stored as a file by an earlier version", async () => {
    const name = `old-${Math.random()}`;
    const open = () => openDB<RoomsDB>(name, 1, { upgrade(db) { db.createObjectStore("documents"); db.createObjectStore("assets"); } });
    const db = await open();
    await db.put("assets", photo("image/jpeg", 33), "old-id");
    const s = createStudioStore(open);
    expect((await s.readImage("asset:old-id"))?.size).toBe(33);
    expect((await s.usage()).bytes).toBe(33);
  });

  it("says plainly when the browser cannot keep an image", async () => {
    const name = `refuse-${Math.random()}`;
    const real = () => openDB<RoomsDB>(name, 1, { upgrade(db) { db.createObjectStore("documents"); db.createObjectStore("assets"); } });
    const s = createStudioStore(async () => { const db = await real(); return new Proxy(db, { get: (t, k) => (k === "put" ? async () => { throw new Error("UnknownError"); } : (t as never)[k as never]) }) as typeof db; });
    await expect(s.putImage(photo())).rejects.toThrow(/private window/);
  });

  it("prunes images the document no longer uses, and keeps the ones it does", async () => {
    const s = fresh();
    const keep = await s.putImage(photo()), drop = await s.putImage(photo());
    const { doc, revision } = await s.load(seed(), "t");
    const page = doc.pages[0];
    const withKept: StudioDocument = { ...doc, pages: [{ ...page, blocks: [{ ...page.blocks[0], assetId: keep }] }, doc.pages[1]] };
    await s.save(withKept, revision, "t");
    expect(await s.prune()).toBe(1);
    expect(await s.readImage(keep)).toBeDefined();
    expect(await s.readImage(drop)).toBeUndefined();
    expect((await s.usage()).images).toBe(1);
  });

  it("reset puts the seed back", async () => {
    const s = fresh();
    const { doc, revision } = await s.load(seed(), "t");
    await s.save({ ...doc, name: "Changed" }, revision, "t");
    const r = await s.reset(seed(), "t");
    expect(r.doc.name).toBe("Habib Saleh");
    expect((await s.load(seed(), "t")).doc.name).toBe("Habib Saleh");
  });
});

describe("several templates in one browser", () => {
  const folio = (): unknown => seed();
  const salon = (): unknown => { const d = seed() as { room: string; pages: { id: string }[] }; return { ...d, room: "salon", pages: d.pages.map((p) => (p.id === "series" ? { ...p, id: "works" } : p)) }; };
  const hasSeries = (d: StudioDocument) => d.pages.some((p) => p.id === "series");
  const hasWorks = (d: StudioDocument) => d.pages.some((p) => p.id === "works");

  it("keeps each template's document apart, so one cannot open another's", async () => {
    const s = fresh();
    const f = await s.load(folio(), "folio", hasSeries);
    await s.save({ ...f.doc, name: "Folio edit" }, f.revision, "folio");
    const sa = await s.load(salon(), "salon", hasWorks);
    expect(sa.seeded).toBe(true);
    expect(sa.doc.pages.some((p) => p.id === "works")).toBe(true);
    expect((await s.load(folio(), "folio", hasSeries)).doc.name).toBe("Folio edit");
    expect((await s.load(salon(), "salon", hasWorks)).doc.name).toBe("Habib Saleh");
  });

  it("a document left in the old shared slot goes to the template that can open it, and only that one", async () => {
    const name = `legacy-${Math.random()}`;
    const open = () => openDB<RoomsDB>(name, 1, { upgrade(db) { db.createObjectStore("documents"); db.createObjectStore("assets"); } });
    const db = await open();
    await db.put("documents", { value: studioSchema.parse(folio()), revision: 7 }, "studio-v14");
    const s = createStudioStore(open);
    const sa = await s.load(salon(), "salon", hasWorks);
    expect(sa.seeded).toBe(true);
    const f = await s.load(folio(), "folio", hasSeries);
    expect(f.seeded).toBe(false);
    expect(f.revision).toBe(7);
    expect(await db.get("documents", "studio-v14")).toBeUndefined();
  });

  it("starts fresh instead of opening a stored document the template cannot use", async () => {
    const s = fresh();
    await s.load(folio(), "salon", () => true);
    const again = await s.load(salon(), "salon", hasWorks);
    expect(again.seeded).toBe(true);
    expect(hasWorks(again.doc)).toBe(true);
  });

  it("never removes an image that any template still uses", async () => {
    const s = fresh();
    const a = await s.putImage(photo()), b = await s.putImage(photo()), orphan = await s.putImage(photo());
    const f = await s.load(folio(), "folio", hasSeries), sa = await s.load(salon(), "salon", hasWorks);
    const use = (d: StudioDocument, id: string): StudioDocument => ({ ...d, pages: [{ ...d.pages[0], blocks: [{ ...d.pages[0].blocks[0], assetId: id }] }, ...d.pages.slice(1)] });
    await s.save(use(f.doc, a), f.revision, "folio");
    await s.save(use(sa.doc, b), sa.revision, "salon");
    expect(await s.prune()).toBe(1);
    expect(await s.readImage(a)).toBeDefined();
    expect(await s.readImage(b)).toBeDefined();
    expect(await s.readImage(orphan)).toBeUndefined();
  });

  it("deletes nothing when a stored document cannot be read", async () => {
    const name = `broken-${Math.random()}`;
    const open = () => openDB<RoomsDB>(name, 1, { upgrade(db) { db.createObjectStore("documents"); db.createObjectStore("assets"); } });
    const s = createStudioStore(open), db = await open();
    const id = await s.putImage(photo());
    await db.put("documents", { value: { broken: true }, revision: 1 }, "studio-v14:folio");
    expect(await s.prune()).toBe(0);
    expect(await s.readImage(id)).toBeDefined();
  });
});

describe("document <-> room round trip", () => {
  const doc = () => studioSchema.parse(seed());

  it("writing back what the room showed changes nothing that matters", () => {
    const d = doc();
    const content = toFolioContent(d, "series", dims);
    const back = fromFolioContent(d, "series", content);
    const view = (x: StudioDocument) => x.pages[0].blocks.map((b) => [b.type, b.assetId, b.title, b.date, b.alt, b.arrange, b.note, b.role === "pause" ? b.text : ""]);
    expect(view(back)).toEqual(view(d));
    expect(back.name).toBe(d.name);
    expect(back.pages[0].title).toBe(d.pages[0].title);
  });

  it("an edit in the room lands in the document: reorder, retitle, add, remove", () => {
    const d = doc();
    const c = toFolioContent(d, "series", dims);
    c.works["a"].title = "Renamed";
    c.works["new1"] = { assetId: "asset:abc", src: "blob:x", w: 1200, h: 800, title: "Untitled", date: "5 Oct 2026", alt: "Untitled" };
    c.blocks.splice(1, 0, { type: "single", work: "new1" });
    delete c.works["c"]; c.blocks = c.blocks.map((b) => (b.type === "pair" && b.works.includes("c") ? { type: "single" as const, work: "b" } : b));
    c.site.title = "After it"; c.site.titleEm = "appears";
    const back = fromFolioContent(d, "series", c);
    const ids = back.pages[0].blocks.map((b) => b.id);
    expect(ids.includes("new1")).toBe(true);
    expect(ids.includes("c")).toBe(false);
    expect(back.pages[0].blocks.find((b) => b.id === "a")?.title).toBe("Renamed");
    expect(back.pages[0].blocks.find((b) => b.id === "new1")?.assetId).toBe("asset:abc");
    expect(back.pages[0].title).toBe("After it appears");
    expect(back.pages[1]).toEqual(d.pages[1]);
  });

  it("keeps a caption and focal point the room does not show", () => {
    const d = doc();
    d.pages[0].blocks[0].focal = { x: 20, y: 70 }; d.pages[0].blocks[0].caption = "Kept";
    const back = fromFolioContent(d, "series", toFolioContent(d, "series", dims));
    expect(back.pages[0].blocks[0].focal).toEqual({ x: 20, y: 70 });
    expect(back.pages[0].blocks[0].caption).toBe("Kept");
  });

  it("refuses content that points at a work it does not contain", () => {
    const d = doc();
    const c = toFolioContent(d, "series", dims);
    c.blocks.push({ type: "single", work: "ghost" });
    expect(() => fromFolioContent(d, "series", c)).toThrow(/ghost/);
  });
});
