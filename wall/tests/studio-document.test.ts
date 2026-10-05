import { describe, it, expect } from "vitest";
import { initialSite, siteSchema, type Site } from "../src/model";
import { enableComposition, groupSections, patchSection } from "../src/composition";
import {
  STUDIO_VERSION,
  studioSchema,
  blockSchema,
  migrateFromV13,
  toFolioContent,
  type RoomAsset,
} from "../src/studio/document";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const asset = (id: string): RoomAsset => (id.includes("tall") ? { src: `/${id}.jpg`, w: 1000, h: 1500 } : { src: `/${id}.jpg`, w: 1500, h: 1000 });

function projectWithThreeImages(): { site: Site; pageId: string; ids: string[] } {
  const site = siteSchema.parse(clone(initialSite));
  const page = site.pages.find((p) => p.kind === "project" && p.blocks.filter((b) => b.type === "image").length >= 3)!;
  const ids = page.blocks.filter((b) => b.type === "image").map((b) => b.id);
  return { site, pageId: page.id, ids };
}
const replacePage = (site: Site, page: Site["pages"][number]): Site => siteSchema.parse({ ...site, pages: site.pages.map((p) => (p.id === page.id ? page : p)) });

describe("studio document v14", () => {
  it("migrates the shipped sample site and keeps every work", () => {
    const { doc } = migrateFromV13(siteSchema.parse(clone(initialSite)));
    expect(doc.version).toBe(STUDIO_VERSION);
    expect(studioSchema.safeParse(doc).success).toBe(true);
    const before = initialSite.pages.flatMap((p) => p.blocks).length;
    expect(doc.pages.flatMap((p) => p.blocks).length).toBe(before);
    expect(doc.pages.map((p) => p.kind)).toEqual(initialSite.pages.map((p) => p.kind));
  });

  it("carries the asset, alt text and focal point of each image", () => {
    const site = siteSchema.parse(clone(initialSite));
    const { doc } = migrateFromV13(site);
    for (const p of site.pages)
      for (const b of p.blocks) {
        const m = doc.pages.find((x) => x.id === p.id)!.blocks.find((x) => x.id === b.id)!;
        expect(m.assetId).toBe(b.assetId);
        expect(m.alt).toBe(b.alt);
        expect(m.focal).toEqual(b.focal);
      }
  });

  it("turns the old caption into a title and never stores geometry", () => {
    const { doc } = migrateFromV13(siteSchema.parse(clone(initialSite)));
    const img = doc.pages.flatMap((p) => p.blocks).find((b) => b.type === "image")!;
    expect(img.title.length).toBeGreaterThan(0);
    expect(Object.keys(img)).not.toEqual(expect.arrayContaining(["gap", "space", "widthPercent", "columnRatio"]));
    expect(blockSchema.safeParse({ ...img, gap: 40 }).success).toBe(false);
  });

  it("maps a two-image column group to a pair", () => {
    const { site, pageId, ids } = projectWithThreeImages();
    let page = enableComposition(site.pages.find((p) => p.id === pageId)!);
    const secs = page.composition!.desktop;
    const at = secs.findIndex((s, i) => i < secs.length - 1 && [s, secs[i + 1]].every((x) => page.blocks.find((b) => b.id === x.blockIds[0])?.type === "image"));
    expect(at).toBeGreaterThan(-1);
    const grouped = groupSections(page, [secs[at].id, secs[at + 1].id]);
    expect(grouped.composition!.desktop.some((s) => s.blockIds.length === 2)).toBe(true);
    page = grouped;
    const migrated = migrateFromV13(replacePage(site, page)).doc;
    const blocks = migrated.pages.find((p) => p.id === pageId)!.blocks.filter((b) => b.type !== "text");
    expect(blocks.some((b) => b.arrange === "with-next")).toBe(true);
    const content = toFolioContent(migrated, pageId, asset);
    expect(content.blocks.some((b) => b.type === "pair")).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });

  it("reports what it could not express instead of dropping it silently", () => {
    const { site, pageId } = projectWithThreeImages();
    let page = enableComposition(site.pages.find((p) => p.id === pageId)!);
    const first = page.composition!.desktop[0].id;
    page = patchSection(page, first, (s) => ({ ...s, widthPercent: 60 }));
    const { notes } = migrateFromV13(replacePage(site, page));
    expect(notes.join(" ")).toMatch(/exact widths/);
  });

  it("builds Folio content: singles, a pause for prose, and no pair across a portrait", () => {
    const { doc } = migrateFromV13(siteSchema.parse(clone(initialSite)));
    const project = doc.pages.find((p) => p.kind === "project")!;
    const blocks = project.blocks.map((b) => ({ ...b }));
    const imgs = blocks.filter((b) => b.type === "image");
    imgs[0].arrange = "with-next";
    imgs[1].assetId = "tall-one";
    const withPortrait = { ...doc, pages: doc.pages.map((p) => (p.id === project.id ? { ...p, blocks } : p)) };
    const c = toFolioContent(withPortrait, project.id, asset);
    expect(c.blocks.filter((b) => b.type === "pair")).toHaveLength(0);
    expect(Object.keys(c.works)).toHaveLength(imgs.length);
    expect(c.blocks.some((b) => b.type === "pause")).toBe(true);
  });

  it("uses a margin note only for a portrait", () => {
    const { doc } = migrateFromV13(siteSchema.parse(clone(initialSite)));
    const project = doc.pages.find((p) => p.kind === "project")!;
    const blocks = project.blocks.map((b) => ({ ...b }));
    const img = blocks.find((b) => b.type === "image")!;
    img.arrange = "margin-note"; img.note = "A note.";
    const make = (assetId: string) => {
      img.assetId = assetId;
      return toFolioContent({ ...doc, pages: doc.pages.map((p) => (p.id === project.id ? { ...p, blocks } : p)) }, project.id, asset).blocks.find((b) => b.type === "split" || b.type === "single");
    };
    expect(make("tall-photo")?.type).toBe("split");
    expect(make("wide-photo")?.type).toBe("single");
  });

  it("rejects a page that does not exist", () => {
    const { doc } = migrateFromV13(siteSchema.parse(clone(initialSite)));
    expect(() => toFolioContent(doc, "nope", asset)).toThrow(/No page/);
  });
});
