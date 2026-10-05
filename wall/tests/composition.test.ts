import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  initialSite,
  siteSchema,
  styleIds,
  blankBlock,
  type Page,
  type Site,
} from "../src/model";
import {
  enableComposition,
  groupSections,
  ungroupSection,
  moveSection,
  moveSectionBlock,
  duplicateSection,
  removeSection,
  reconcileBlocks,
  patchSection,
  orderedSections,
  sectionBlocks,
  canGroup,
} from "../src/composition";
import { updateTarget } from "../src/editing";
import {
  createHistory,
  editHistory,
  undoHistory,
  redoHistory,
} from "../src/history";
import {
  database,
  loadDocument,
  saveDocument,
  exportBackup,
  importBackup,
} from "../src/storage";
import { createSample, sampleIds } from "../src/samples";
const withPage = (page: Page, site: Site = initialSite): Site => ({
  ...site,
  pages: site.pages.map((p) => (p.id === page.id ? page : p)),
});
const source = () =>
  structuredClone(initialSite.pages.find((p) => p.id === "quiet")!);
const compose = () => enableComposition(source());
const mobileIds = (p: Page) =>
  orderedSections(p.composition!, true).flatMap((s) =>
    sectionBlocks(p, s).map((b) => b.id),
  );
const legacyV3 = () => ({
  ...structuredClone(initialSite),
  version: 3,
  pages: initialSite.pages.map(({ composition, ...p }) => {
    void composition;
    return structuredClone(p);
  }),
});
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("compatible document version four", () => {
  it("reads v3 nondestructively and retains exact original on first composition save", async () => {
    const old = legacyV3();
    old.pages[1].blocks[0].focal = { x: 12, y: 87 };
    const db = await database();
    await db.put("documents", { value: old, revision: 9 }, "site");
    const loaded = await loadDocument();
    expect(loaded.value.version).toBe(13);
    expect(
      loaded.value.pages.map(({ composition, ...p }) => {
        expect(composition).toBeNull();
        return p;
      }),
    ).toEqual(old.pages);
    expect((await db.get("documents", "site"))!.value).toEqual(old);
    const arranged = withPage(
      enableComposition(loaded.value.pages[1]),
      loaded.value,
    );
    await saveDocument(arranged, 9);
    expect(await db.get("documents", "pre-composition-system")).toEqual({
      value: old,
      revision: 9,
    });
    expect(await db.get("documents", "pre-identity-system")).toBeUndefined();
    expect((await loadDocument()).value).toEqual(arranged);
  });
  it("imports a real v3-shaped backup with all identity/copy/crops intact", async () => {
    const old = legacyV3();
    old.appearances.gallery.identity.margin = 11;
    old.copy.closingText = "My authored ending";
    const restored = await importBackup(
      JSON.stringify({
        format: "latent-studio-backup",
        version: 3,
        site: old,
        assets: {},
      }),
      0,
    );
    expect(restored.value.appearances).toEqual(old.appearances);
    expect(restored.value.copy).toEqual(old.copy);
    expect(restored.value.pages[1].blocks).toEqual(old.pages[1].blocks);
  });
  it("rejects orphan, duplicated, reordered and foreign mobile references without replacing work", async () => {
    const page = compose(),
      saved = withPage(page);
    await saveDocument(saved, 0);
    for (const mutate of [
      (p: Page) => p.composition!.desktop[0].blockIds.push(p.blocks[1].id),
      (p: Page) => p.composition!.desktop.pop(),
      (p: Page) => p.composition!.desktop.reverse(),
      (p: Page) => {
        p.composition!.mobile[0].blockIds = ["unknown"];
      },
      (p: Page) => {
        p.composition!.desktop[1].id = p.composition!.desktop[0].id;
      },
    ]) {
      const bad = structuredClone(page);
      mutate(bad);
      await expect(saveDocument(withPage(bad), 1)).rejects.toThrow();
      expect((await loadDocument()).value).toEqual(saved);
    }
  });
  it("round trips independent desktop/mobile arrangements, all source and identity", async () => {
    let page = compose();
    page = groupSections(
      page,
      page.composition!.desktop.slice(0, 2).map((s) => s.id),
      "group",
    );
    page = patchSection(page, "group", (s) => ({
      ...s,
      layout: "emphasis-right",
      width: "wide",
    }));
    page = patchSection(
      page,
      page.composition!.mobile[0].id,
      (s) => ({ ...s, gap: 12 }),
      true,
    );
    page = moveSection(page, page.composition!.mobile[0].id, 1, true);
    const site = withPage(page),
      backup = await exportBackup(site);
    expect(JSON.parse(backup).version).toBe(13);
    const restored = await importBackup(backup, 0);
    expect(restored.value).toEqual(site);
    expect((await loadDocument()).value).toEqual(site);
  });
  it("rejects a stale v3 editor revision after a new composition save", async () => {
    const old = legacyV3(),
      db = await database();
    await db.put("documents", { value: old, revision: 6 }, "site");
    const next = withPage(compose());
    await saveDocument(next, 6);
    await expect(saveDocument(siteSchema.parse(old), 6)).rejects.toThrow(
      "another window",
    );
    expect((await loadDocument()).value).toEqual(next);
  });
});
describe("explicit composition operations preserve authorship", () => {
  it("groups adjacent works without changing any source/caption/crop/focal values", () => {
    const p = compose(),
      before = structuredClone(p.blocks);
    p.blocks[0].focal = { x: 16, y: 74 };
    before[0].focal = { x: 16, y: 74 };
    const grouped = groupSections(
      p,
      p.composition!.desktop.slice(0, 2).map((s) => s.id),
      "pair",
    );
    expect(grouped.blocks).toEqual(before);
    expect(grouped.composition!.desktop[0].blockIds).toEqual(
      before.slice(0, 2).map((b) => b.id),
    );
    expect(siteSchema.safeParse(withPage(grouped)).success).toBe(true);
  });
  it("refuses non-adjacent, unknown and oversized grouping instead of silently moving work", () => {
    let p = compose();
    while (p.blocks.length < 6)
      p = reconcileBlocks(p, [...p.blocks, blankBlock("text")]);
    const ids = p.composition!.desktop.map((s) => s.id);
    for (const chosen of [
      [ids[0], ids[2]],
      ids.slice(0, 5),
      [ids[0], "missing"],
    ]) {
      expect(canGroup(p, chosen)).toBe(false);
      expect(groupSections(p, chosen)).toBe(p);
    }
  });
  it("keeps explicit mobile order when desktop sections move", () => {
    let p = compose();
    const ids = p.composition!.desktop.map((s) => s.id);
    p = moveSection(p, p.composition!.mobile[0].id, 1, true);
    const mobile = mobileIds(p);
    p = moveSection(p, ids[0], 2);
    expect(mobileIds(p)).toEqual(mobile);
    expect(p.blocks[2].id).toBe(source().blocks[0].id);
  });
  it("ungroups a reversed phone pair without changing desktop or phone reading order", () => {
    let p = compose();
    p = groupSections(
      p,
      p.composition!.mobile.slice(0, 2).map((s) => s.id),
      "pair",
      true,
    );
    p = patchSection(
      p,
      "pair",
      (s) => ({ ...s, blockIds: [...s.blockIds].reverse() }),
      true,
    );
    const before = mobileIds(p),
      sourceOrder = p.blocks.map((b) => b.id);
    p = ungroupSection(p, "pair", undefined, true);
    expect(mobileIds(p)).toEqual(before);
    expect(p.blocks.map((b) => b.id)).toEqual(sourceOrder);
    expect(siteSchema.safeParse(withPage(p)).success).toBe(true);
  });
  it("duplicates independent blocks and geometry with new IDs while retaining source media", () => {
    const p = compose(),
      id = p.composition!.desktop[0].id;
    const duplicated = duplicateSection(p, id);
    const original = p.blocks[0],
      copy = duplicated.blocks[1];
    expect(copy.id).not.toBe(original.id);
    expect(copy.assetId).toBe(original.assetId);
    expect(copy.focal).toEqual(original.focal);
    copy.caption = "Independent caption";
    expect(p.blocks[0].caption).toBe(original.caption);
    expect(siteSchema.safeParse(withPage(duplicated)).success).toBe(true);
  });
  it("restores removed groups and source content exactly with undo and redo", () => {
    let p = compose();
    p = groupSections(
      p,
      p.composition!.desktop.slice(0, 2).map((s) => s.id),
      "pair",
    );
    const site = withPage(p);
    let h = editHistory(
      createHistory(site),
      withPage(removeSection(p, "pair")),
    );
    expect(h.present.pages[1].blocks).toHaveLength(p.blocks.length - 2);
    h = undoHistory(h);
    expect(h.present).toEqual(site);
    expect(redoHistory(h).present.pages[1].blocks).toHaveLength(
      p.blocks.length - 2,
    );
  });
  it("retains groups/mobile settings through explicit block add/remove", () => {
    let p = compose();
    p = groupSections(
      p,
      p.composition!.desktop.slice(0, 2).map((s) => s.id),
      "pair",
    );
    p = patchSection(p, "pair", (s) => ({
      ...s,
      space: 100,
    }));
    const fresh = blankBlock("text");
    p = reconcileBlocks(p, [...p.blocks, fresh]);
    expect(p.composition!.desktop[0].space).toBe(100);
    p = reconcileBlocks(
      p,
      p.blocks.filter((b) => b.id !== p.blocks[0].id),
    );
    expect(p.composition!.desktop[0].blockIds).toHaveLength(1);
    expect(p.blocks.at(-1)!.id).toBe(fresh.id);
    expect(siteSchema.safeParse(withPage(p)).success).toBe(true);
  });
  it("edits the original stable target after grouping, duplication and member reordering", () => {
    let p = compose();
    p = groupSections(
      p,
      p.composition!.desktop.slice(0, 2).map((s) => s.id),
      "pair",
    );
    const original = p.blocks[0];
    p = duplicateSection(p, "pair");
    p = moveSectionBlock(p, "pair", original.id, 1);
    let site = withPage(p);
    site = updateTarget(
      site,
      { kind: "block", pageId: p.id, blockId: original.id, field: "caption" },
      "Still the original",
    );
    expect(
      site.pages[1].blocks.find((b) => b.id === original.id)!.caption,
    ).toBe("Still the original");
    expect(
      site.pages[1].blocks.filter((b) => b.caption === "Still the original"),
    ).toHaveLength(1);
    expect(siteSchema.safeParse(site).success).toBe(true);
  });
  it("keeps every source and composition through all four style switches and original-layout toggle", () => {
    const p = compose(),
      site = withPage(p);
    for (const styleId of styleIds) {
      const switched = siteSchema.parse({ ...site, styleId });
      expect(switched.pages).toEqual(site.pages);
      expect(switched.appearances).toEqual(site.appearances);
    }
    const hidden = { ...p, composition: { ...p.composition!, enabled: false } };
    expect(enableComposition(hidden)).toEqual(p);
  });
  it("supports every isolated study without rewriting its authored seed or homepage", () => {
    for (const id of sampleIds) {
      const sample = createSample(id),
        original = structuredClone(sample);
      for (const p of sample.pages.filter((p) => p.kind !== "home")) {
        const arranged = enableComposition(p);
        expect(arranged.blocks).toEqual(p.blocks);
        expect(siteSchema.safeParse(withPage(arranged, sample)).success).toBe(
          true,
        );
      }
      expect(sample).toEqual(original);
      expect(enableComposition(sample.pages[0])).toBe(sample.pages[0]);
    }
  });
});
