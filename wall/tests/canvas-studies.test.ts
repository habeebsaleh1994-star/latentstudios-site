import { portableHTML, portablePackage } from "../src/portable";
import type { Revision } from "../src/revisions";
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initialSite, siteSchema, blankBlock, type Page } from "../src/model";
import {
  beginCanvas,
  captureStudy,
  keepStudy,
  applyStudy,
  applyStudySafely,
  proposeArrangement,
  publicWebsite,
  resizeSection,
  studyChanges,
} from "../src/compositionStudies";
import {
  groupSections,
  moveSection,
  reconcileBlocks,
} from "../src/composition";
import {
  createHistory,
  editHistory,
  undoHistory,
  redoHistory,
} from "../src/history";
import {
  database,
  saveDocument,
  loadDocument,
  exportBackup,
  importBackup,
} from "../src/storage";
const source = () =>
  structuredClone(initialSite.pages.find((p) => p.id === "quiet")!);
const site = (page: Page) => ({
  ...structuredClone(initialSite),
  pages: initialSite.pages.map((p) => (p.id === page.id ? page : p)),
});
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("composition studies preserve current materials", () => {
  it("retains the starting arrangement once and captures geometry only", () => {
    const original = source(),
      p = beginCanvas(original),
      again = beginCanvas(p);
    expect(p.studies).toHaveLength(1);
    expect(p.studies![0].composition).toBeNull();
    expect(again.studies).toEqual(p.studies);
    expect(p.blocks).toEqual(original.blocks);
    expect(Object.keys(p.studies![0]).sort()).toEqual([
      "composition",
      "createdAt",
      "id",
      "name",
      "order",
    ]);
    expect(siteSchema.parse(site(p))).toEqual(site(p));
  });
  it("restores order and grouping with current captions, media, fit and focal points", () => {
    let p = beginCanvas(source());
    const first = p.composition!.desktop[0].id,
      saved = captureStudy(p, "Before");
    p = moveSection(p, first, 2);
    p = {
      ...p,
      blocks: p.blocks.map((b) => ({
        ...b,
        caption: "Latest caption",
        text: "Latest words",
        assetId: b.assetId + "-new",
        fit: "portrait",
        focal: { x: 14, y: 86 },
      })),
    };
    const restored = applyStudy(p, saved);
    expect(restored.blocks.map((b) => b.id)).toEqual(saved.order);
    for (const b of restored.blocks)
      expect(b).toEqual(p.blocks.find((current) => current.id === b.id));
    expect(restored.composition).toEqual(saved.composition);
  });
  it("reconciles removed and added works without resurrecting stale content", () => {
    let p = beginCanvas(source());
    const saved = captureStudy(p, "Before"),
      added = blankBlock("text");
    p = reconcileBlocks(p, [...p.blocks.slice(1), added]);
    const restored = applyStudy(p, saved);
    expect(studyChanges(p, saved)).toEqual({ added: 1, removed: 1 });
    expect(restored.blocks).toEqual(p.blocks);
    expect(siteSchema.safeParse(site(restored)).success).toBe(true);
  });
  it("keeps the displaced arrangement and restores everything with one Undo", () => {
    let p = beginCanvas(source());
    const saved = captureStudy(p, "Original");
    p = moveSection(p, p.composition!.mobile[0].id, 2, true);
    const before = site(p),
      after = site(applyStudySafely(p, saved));
    let history = editHistory(createHistory(before), after);
    expect(
      after.pages.find((x) => x.id === p.id)!.studies!.at(-1)!.composition,
    ).toEqual(p.composition);
    history = undoHistory(history);
    expect(history.present).toEqual(before);
    expect(redoHistory(history).present).toEqual(after);
  });
  it.each([1, 2, 3, 4])(
    "offers three distinct arrangements for %i works, changing only the selected section",
    (count) => {
      let p = beginCanvas(source());
      while (p.blocks.length < count + 1)
        p = reconcileBlocks(p, [...p.blocks, blankBlock("text")]);
      if (count > 1)
        p = groupSections(
          p,
          p.composition!.desktop.slice(0, count).map((s) => s.id),
          "chosen",
        );
      const chosen = p.composition!.desktop[0],
        others = p.composition!.desktop.slice(1),
        fingerprints = [];
      for (const option of ["balanced", "leading", "quiet"] as const) {
        const next = proposeArrangement(p, chosen.id, option);
        expect(next.blocks).toEqual(p.blocks);
        expect(next.composition!.desktop.slice(1)).toEqual(others);
        expect(next.composition!.mobile).toEqual(p.composition!.mobile);
        expect(siteSchema.safeParse(site(next)).success).toBe(true);
        fingerprints.push(JSON.stringify(next.composition!.desktop[0]));
      }
      expect(new Set(fingerprints).size).toBe(3);
    },
  );
  it("changes only device width, without changing source crop or mobile order", () => {
    const p = beginCanvas(source()),
      section = p.composition!.desktop[0];
    expect(resizeSection(section, 64)).toEqual({
      ...section,
      widthPercent: 64,
    });
    expect(resizeSection(section, 88)).toEqual({
      ...section,
      widthPercent: 88,
    });
  });
  it("caps studies and rejects duplicate or incoherent identities", () => {
    let p = beginCanvas(source());
    while (p.studies!.length < 12) p = keepStudy(p, "Study");
    expect(() => keepStudy(p, "Overflow")).toThrow("12");
    p.studies![1].id = p.studies![0].id;
    expect(siteSchema.safeParse(site(p)).success).toBe(false);
    p = beginCanvas(source());
    p.studies![0].order.push(p.studies![0].order[0]);
    expect(siteSchema.safeParse(site(p)).success).toBe(false);
  });
  it("migrates v7 without altering storage until save and retains the exact old record", async () => {
    const old = { ...structuredClone(initialSite), version: 7 },
      db = await database();
    await db.put("documents", { value: old, revision: 5 }, "site");
    const loaded = await loadDocument();
    expect(loaded.value.version).toBe(13);
    expect((await db.get("documents", "site"))!.value).toEqual(old);
    await saveDocument(
      site(beginCanvas(loaded.value.pages.find((p) => p.id === "quiet")!)),
      5,
    );
    expect(await db.get("documents", "pre-canvas-studies")).toEqual({
      value: old,
      revision: 5,
    });
  });
  it("keeps studies in editable backups and removes them from the public document", async () => {
    const draft = site(beginCanvas(source())),
      backup = await exportBackup(draft);
    expect(JSON.parse(backup).version).toBe(13);
    expect((await importBackup(backup, 0)).value).toEqual(draft);
    const publicSite = publicWebsite(draft);
    expect(publicSite.pages.every((p) => !("studies" in p))).toBe(true);
    expect(publicSite.appearances).toEqual(draft.appearances);
    expect(publicSite.pages[1].blocks).toEqual(draft.pages[1].blocks);
    expect(JSON.stringify(publicSite)).not.toContain("Starting point");
    expect(siteSchema.safeParse(publicSite).success).toBe(true);
  });
});

it("omits private study names and unselected arrangements from both actual website export formats", async () => {
  const draft = site(
    beginCanvas({
      ...source(),
      blocks: [blankBlock("text")],
      composition: null,
    }),
  );
  draft.pages = draft.pages.map((p) => ({
    ...p,
    blocks: p.blocks.filter((b) => b.type === "text"),
  }));
  const page = draft.pages.find((p) => p.id === "quiet")!;
  page.studies![0].name = "Private experiment 739821";
  const revision: Revision = {
    format: "latent-studio-revision",
    version: 1,
    id: "private-study-check",
    name: "Export",
    createdAt: "",
    sourceRevision: 1,
    site: draft,
    assets: {},
    manifest: [],
  };
  const html = await portableHTML(revision),
    folder = await portablePackage(revision, "original");
  const data = JSON.parse(
    html.match(
      /<script id="latent-document" type="application\/json">(.*?)<\/script>/s,
    )![1],
  );
  expect(
    data.site.pages.find((p: Page) => p.id === "quiet").composition,
  ).toEqual(page.composition);
  expect(html).not.toContain("Private experiment 739821");
  expect(await folder.blob.text()).not.toContain("Private experiment 739821");
  expect(data.site.pages.every((p: Page) => !("studies" in p))).toBe(true);
  expect(
    revision.site.pages.find((p) => p.id === "quiet")!.studies![0].name,
  ).toBe("Private experiment 739821");
});
