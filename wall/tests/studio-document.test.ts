import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { studioSchema, blockSchema, toFolioContent, type RoomAsset } from "../src/studio/document";

const seed = () => studioSchema.parse(JSON.parse(readFileSync("design/folio/doc/before-it-disappears.studio.json", "utf8")));
const asset = (id: string): RoomAsset => (id.includes("tall") ? { src: `/${id}.jpg`, w: 1000, h: 1500 } : { src: `/${id}.jpg`, w: 1500, h: 1000 });

describe("studio document", () => {
  it("opens the shipped sample document", () => {
    const doc = seed();
    expect(studioSchema.safeParse(doc).success).toBe(true);
    expect(doc.pages.some((p) => p.kind === "project")).toBe(true);
  });

  it("never stores geometry on a block", () => {
    const img = seed().pages.flatMap((p) => p.blocks).find((b) => b.type === "image")!;
    expect(img.title.length).toBeGreaterThan(0);
    expect(blockSchema.safeParse({ ...img, gap: 40 }).success).toBe(false);
  });

  it("builds Folio content: singles, a pause for prose, and no pair across a portrait", () => {
    const doc = seed();
    const project = doc.pages.find((p) => p.kind === "project")!;
    const blocks = project.blocks.map((b) => ({ ...b }));
    const imgs = blocks.filter((b) => b.type === "image");
    imgs.forEach((b) => { b.arrange = "alone"; });
    imgs[0].arrange = "with-next";
    imgs[1].assetId = "tall-one";
    const withPortrait = { ...doc, pages: doc.pages.map((p) => (p.id === project.id ? { ...p, blocks } : p)) };
    const c = toFolioContent(withPortrait, project.id, asset);
    expect(c.blocks.filter((b) => b.type === "pair")).toHaveLength(0);
    expect(Object.keys(c.works)).toHaveLength(imgs.length);
    expect(c.blocks.some((b) => b.type === "pause")).toBe(true);
  });

  it("uses a margin note only for a portrait", () => {
    const doc = seed();
    const project = doc.pages.find((p) => p.kind === "project")!;
    const blocks = project.blocks.map((b) => ({ ...b }));
    const img = blocks.find((b) => b.type === "image")!;
    blocks.forEach((b) => { b.arrange = "alone"; });
    img.arrange = "margin-note"; img.note = "A note.";
    const make = (assetId: string) => {
      img.assetId = assetId;
      return toFolioContent({ ...doc, pages: doc.pages.map((p) => (p.id === project.id ? { ...p, blocks } : p)) }, project.id, asset).blocks.find((b) => b.type === "split" || b.type === "single");
    };
    expect(make("tall-photo")?.type).toBe("split");
    expect(make("wide-photo")?.type).toBe("single");
  });

  it("rejects a page that does not exist", () => {
    expect(() => toFolioContent(seed(), "nope", asset)).toThrow(/No page/);
  });
});
