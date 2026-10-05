import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import { fixturePage, fixtureSite } from "./viewportFixtures";
import { siteSchema } from "../src/model";
import { patchCaption } from "../src/captions";
import {
  patchSection,
  duplicateSection,
  reconcileBlocks,
} from "../src/composition";
import {
  captureStudy,
  applyStudy,
  applyFlowSafely,
} from "../src/compositionStudies";
import { planGrouping } from "../src/regrouping";
import {
  database,
  loadDocument,
  saveDocument,
  exportBackup,
  importBackup,
} from "../src/storage";
import { localRevisions } from "../src/revisions";
import { portableHTML, portablePackage } from "../src/portable";
import { documentInput } from "../backend/validation";
import { intersects } from "../src/readability";
const fixture = () => {
  const s = fixtureSite(fixturePage());
  s.pages.forEach((p) =>
    p.blocks.forEach((b) => {
      b.type = "text";
      b.assetId = "";
    }),
  );
  return s;
};
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("explicit device caption treatments", () => {
  it("changes one device arrangement without editing words, originals, crop, type, reading order or layers", () => {
    const s = fixture(),
      p = s.pages[1],
      before = structuredClone(p);
    const next = patchSection(p, "first", (s) =>
      patchCaption(s, "a", { size: 16, backing: "paper", position: "above" }),
    );
    expect(next.blocks).toEqual(before.blocks);
    expect(next.composition!.mobile).toEqual(before.composition!.mobile);
    expect(next.composition!.desktop[0].blockIds).toEqual(
      before.composition!.desktop[0].blockIds,
    );
    expect(next.composition!.desktop[0].captions).toEqual([
      { blockId: "a", size: 16, backing: "paper", position: "above" },
    ]);
    expect(
      patchSection(next, "first", (s) => patchCaption(s, "a", null)),
    ).toEqual(before);
  });
  it("retains treatments in flow conversion and named studies while applying current content", () => {
    const s = fixture();
    let p = s.pages[1];
    p = patchSection(p, "first", (s) => ({
      ...patchCaption(s, "a", { size: 14, backing: "ink" }),
      spatial: {
        enabled: true,
        minHeight: 400,
        frames: s.blockIds.map((blockId) => ({
          blockId,
          x: 0,
          y: 20,
          width: 50,
        })),
        layers: [...s.blockIds],
      },
    }));
    const study = captureStudy(p, "Readability");
    const flow = applyFlowSafely(p, "first");
    expect(flow.composition!.desktop[0].captions).toEqual(
      p.composition!.desktop[0].captions,
    );
    expect(flow.studies!.at(-1)!.composition).toEqual(p.composition);
    const live = structuredClone(flow);
    live.blocks[0].text = "Later manuscript";
    expect(applyStudy(live, study).blocks[0].text).toBe("Later manuscript");
    expect(applyStudy(live, study).composition).toEqual(study.composition);
  });
  it("remaps duplication and prunes only removed works", () => {
    let p = fixture().pages[1];
    p = patchSection(p, "first", (s) => patchCaption(s, "a", { size: 16 }));
    let id = 0;
    const copied = duplicateSection(p, "first", () => `copy-${++id}`);
    const c = copied.composition!.desktop.find((s) => s.id === "copy-3")!;
    expect(c.captions).toEqual([{ blockId: "copy-1", size: 16 }]);
    const next = reconcileBlocks(
      p,
      p.blocks.filter((b) => b.id !== "a"),
    );
    expect(next.composition!.desktop[0].captions).toEqual([]);
    expect(
      siteSchema.safeParse({ ...fixture(), pages: [fixture().pages[0], next] })
        .success,
    ).toBe(true);
  });
  it("carries per-work treatments across explicit flowing regrouping", () => {
    let p = fixture().pages[1];
    p = patchSection(p, "first", (s) => patchCaption(s, "b", { size: 14 }));
    p = patchSection(p, "second", (s) =>
      patchCaption(s, "c", { backing: "paper" }),
    );
    const result = planGrouping(p, ["b", "c"], "group", "merged");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        result.page.composition!.desktop.find((s) => s.id === "merged")!
          .captions,
      ).toEqual([
        { blockId: "b", size: 14 },
        { blockId: "c", backing: "paper" },
      ]);
      expect(
        siteSchema.safeParse({
          ...fixture(),
          pages: [fixture().pages[0], result.page],
        }).success,
      ).toBe(true);
    }
  });
  it.each([
    "small",
    "large",
    "position",
    "backing",
    "foreign",
    "duplicate",
    "unknown",
  ])("rejects malformed treatment %s without normalizing it away", (kind) => {
    const s = fixture(),
      section = s.pages[1].composition!.desktop[0];
    const treatment: Record<string, unknown> = { blockId: "a", size: 14 };
    if (kind === "small") treatment.size = 9;
    if (kind === "large") treatment.size = 25;
    if (kind === "position") treatment.position = "floating";
    if (kind === "backing") treatment.backing = "automatic";
    if (kind === "foreign") treatment.blockId = "missing";
    if (kind === "unknown") treatment.rotation = 20;
    Object.assign(section, {
      captions: kind === "duplicate" ? [treatment, treatment] : [treatment],
    });
    expect(siteSchema.safeParse(s).success).toBe(false);
    expect(() => documentInput(s)).toThrow();
  });
});
describe("v12 durable model", () => {
  it("pure v11 load retains old defaults and first save preserves its exact record", async () => {
    const s = fixture(),
      raw = { value: { ...s, version: 11 }, revision: 4 },
      db = await database();
    await db.put("documents", raw, "site");
    expect((await loadDocument())!.value).toEqual(s);
    expect(await db.get("documents", "site")).toEqual(raw);
    const next = structuredClone(s);
    next.pages[1] = patchSection(next.pages[1], "first", (s) =>
      patchCaption(s, "a", { size: 16 }),
    );
    await saveDocument(next, 4);
    expect(await db.get("documents", "pre-caption-readability")).toEqual(raw);
    await expect(saveDocument(next, 4)).rejects.toThrow("another window");
    expect(await db.get("documents", "pre-caption-readability")).toEqual(raw);
  });
  it("round trips backups, immutable revisions, backend validation and both deliveries", async () => {
    const s = fixture();
    s.pages[1] = patchSection(s.pages[1], "first", (s) =>
      patchCaption(s, "a", { size: 16, backing: "paper", position: "above" }),
    );
    const backup = await exportBackup(s);
    expect(JSON.parse(backup).version).toBe(13);
    await importBackup(backup, 0);
    expect((await loadDocument())!.value).toEqual(s);
    const revision = await localRevisions.checkpoint(s, 1, "Captions");
    const next = structuredClone(s);
    next.pages[1] = patchSection(next.pages[1], "first", (s) =>
      patchCaption(s, "a", { size: 20 }),
    );
    await saveDocument(next, 1);
    expect((await localRevisions.read("revision:" + revision.id)).site).toEqual(
      s,
    );
    expect(await portableHTML(revision)).toContain('"captions"');
    expect((await portablePackage(revision)).blob.size).toBeGreaterThan(100);
    expect(documentInput(s)).toEqual(s);
  });
  it("refuses new caption fields labelled as an old immutable document", () => {
    const s = fixture();
    s.pages[1] = patchSection(s.pages[1], "first", (s) =>
      patchCaption(s, "a", { size: 16 }),
    );
    expect(siteSchema.safeParse({ ...s, version: 11 }).success).toBe(false);
  });
  it("keeps geometric overlap evidence distinct from touching edges", () => {
    const text = { left: 10, right: 30, top: 10, bottom: 30 };
    expect(intersects(text, { left: 30, right: 60, top: 10, bottom: 30 })).toBe(
      false,
    );
    expect(intersects(text, { left: 20, right: 60, top: 20, bottom: 40 })).toBe(
      true,
    );
  });
});
