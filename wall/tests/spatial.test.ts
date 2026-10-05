import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { siteSchema, type Site, type SpatialLayout } from "../src/model";
import { fixturePage, fixtureSite } from "./viewportFixtures";
import {
  boundFrame,
  resizeFrame,
  patchFrame,
  layerWork,
  snapFrame,
} from "../src/spatial";
import {
  patchSection,
  moveSectionBlock,
  reconcileBlocks,
  duplicateSection,
  ungroupSection,
} from "../src/composition";
import { planGrouping } from "../src/regrouping";
import { planWorkDrop } from "../src/workDrop";
import {
  captureStudy,
  applyStudy,
  applyFlowSafely,
  flowArrangement,
  proposeArrangement,
} from "../src/compositionStudies";
import { createHistory, editHistory, undoHistory } from "../src/history";
import {
  database,
  loadDocument,
  saveDocument,
  importBackup,
  exportBackup,
} from "../src/storage";
import { localRevisions, type Revision } from "../src/revisions";
import { portableHTML, portablePackage } from "../src/portable";
import { documentInput } from "../backend/validation";
const layout = (): SpatialLayout => ({
  enabled: true,
  minHeight: 500,
  frames: [
    { blockId: "a", x: 5, y: 40, width: 55 },
    { blockId: "b", x: 35, y: 180, width: 50 },
  ],
  layers: ["b", "a"],
});
const fixture = (): Site => {
  const s = fixtureSite(fixturePage());
  s.pages.forEach((p) =>
    p.blocks.forEach((b) => {
      b.type = "text";
      b.assetId = "";
      b.text = `Source ${b.id}\n  keeps its shape`;
    }),
  );
  s.pages[1].composition!.desktop[0].spatial = layout();
  return s;
};
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("spatial ownership and intrinsic frame contract", () => {
  it("keeps reading order, layers, frames and shared content independent", () => {
    const s = fixture(),
      p = s.pages[1],
      before = structuredClone(p);
    const placed = patchSection(p, "first", (s) =>
      patchFrame(s, "a", (f) => ({ ...f, x: 12, y: 244, width: 40 })),
    );
    expect(placed.blocks).toEqual(before.blocks);
    expect(placed.composition!.mobile).toEqual(before.composition!.mobile);
    expect(placed.composition!.desktop[0].blockIds).toEqual(["a", "b"]);
    expect(placed.composition!.desktop[0].spatial!.layers).toEqual(["b", "a"]);
    const layered = patchSection(placed, "first", (s) => layerWork(s, "b", 1));
    expect(layered.composition!.desktop[0].spatial!.layers).toEqual(["a", "b"]);
    expect(layered.composition!.desktop[0].blockIds).toEqual(["a", "b"]);
    const read = moveSectionBlock(layered, "first", "a", 1);
    expect(read.composition!.desktop[0].blockIds).toEqual(["b", "a"]);
    expect(read.composition!.desktop[0].spatial).toEqual(
      layered.composition!.desktop[0].spatial,
    );
    expect(read.blocks[0]).toEqual(before.blocks[1]);
    expect(siteSchema.parse({ ...s, pages: [s.pages[0], read] }).version).toBe(
      13,
    );
  });
  it("constrains horizontal edges, permits tall content offsets and has no stored per-work height/crop", () => {
    expect(boundFrame({ blockId: "a", x: 95, y: -4, width: 80 })).toEqual({
      blockId: "a",
      x: 20,
      y: 0,
      width: 80,
    });
    expect(boundFrame({ blockId: "a", x: -8, y: 12345.67, width: 3 })).toEqual({
      blockId: "a",
      x: 0,
      y: 12345.67,
      width: 10,
    });
    expect(resizeFrame({ blockId: "a", x: 40, y: 20, width: 30 }, 90)).toEqual({
      blockId: "a",
      x: 40,
      y: 20,
      width: 60,
    });
    expect(Object.keys(layout().frames[0])).toEqual([
      "blockId",
      "x",
      "y",
      "width",
    ]);
  });
  it("snaps edges and equal horizontal gaps without changing reading or layer state", () => {
    const left = { blockId: "a", x: 0, y: 0, width: 20 },
      right = { blockId: "c", x: 80, y: 0, width: 20 },
      middle = { blockId: "b", x: 39.7, y: 80, width: 20 };
    const snapped = snapFrame(middle, [left, right], 1000, {});
    expect(snapped.frame.x).toBe(40);
    expect(
      snapped.guides.some(
        (g) => g.label === "Equal gaps" || g.label === "Centre",
      ),
    ).toBe(true);
    expect(
      snapFrame({ ...middle, x: 35 }, [left, right], 1000, {}).frame.x,
    ).toBe(35);
    expect(
      snapFrame({ ...middle, x: 79.8, width: 20 }, [], 1000, {}).frame.x,
    ).toBe(80);
  });
  it("snaps vertical equal gaps using actual intrinsic heights", () => {
    const top = { blockId: "a", x: 0, y: 0, width: 20 },
      bottom = { blockId: "c", x: 0, y: 200, width: 20 };
    const result = snapFrame(
      { blockId: "b", x: 30, y: 98, width: 20 },
      [top, bottom],
      1000,
      { a: 50, b: 50, c: 50 },
    );
    expect(result.frame.y).toBe(100);
    expect(result.guides.some((g) => g.label === "Equal gaps")).toBe(true);
  });
  it("width snapping never stretches the authored media or changes text", () => {
    const result = snapFrame(
      { blockId: "b", x: 10, y: 20, width: 39.7 },
      [],
      1000,
      {},
      true,
    );
    expect(result.frame.width).toBe(40);
    expect(result.frame.y).toBe(20);
  });
  it("one complete placement restores with one Undo", () => {
    const s = fixture(),
      next = {
        ...s,
        pages: [
          s.pages[0],
          patchSection(s.pages[1], "first", (s) =>
            patchFrame(s, "a", (f) => ({ ...f, x: 20, y: 300 })),
          ),
        ],
      };
    expect(undoHistory(editHistory(createHistory(s), next)).present).toEqual(s);
  });
});
describe("safe flow, studies and content changes", () => {
  it("flow preview is pure, Apply keeps a complete spatial study and dormant frames", () => {
    const p = fixture().pages[1],
      before = structuredClone(p),
      preview = flowArrangement(p, "first");
    expect(p).toEqual(before);
    expect(preview.studies).toEqual(p.studies);
    expect(preview.composition!.desktop[0].spatial).toEqual({
      ...layout(),
      enabled: false,
    });
    const applied = applyFlowSafely(p, "first");
    expect(applied.studies!.at(-1)!.composition).toEqual(before.composition);
    expect(applied.blocks).toEqual(before.blocks);
    expect(applied.composition!.mobile).toEqual(before.composition!.mobile);
    expect(
      patchSection(applied, "first", (s) => ({
        ...s,
        spatial: { ...s.spatial!, enabled: true },
      })).composition,
    ).toEqual(before.composition);
  });
  it("a full study shelf refuses conversion rather than silently discarding placement", () => {
    const p = fixture().pages[1];
    p.studies = Array.from({ length: 12 }, (_, i) =>
      captureStudy(p, `Saved ${i}`, String(i)),
    );
    expect(() => applyFlowSafely(p, "first")).toThrow("12 studies");
    expect(p.composition!.desktop[0].spatial!.enabled).toBe(true);
  });
  it("study application restores geometry/read order/layers and keeps current manuscript and type", () => {
    let p = fixture().pages[1];
    const study = captureStudy(p, "Placed");
    p = moveSectionBlock(p, "first", "a", 1);
    p = patchSection(p, "first", (s) =>
      layerWork(
        patchFrame(s, "b", (f) => ({ ...f, y: 600 })),
        "b",
        1,
      ),
    );
    p.blocks[0] = {
      ...p.blocks[0],
      text: "New\n  words",
      typography: { styleId: null, base: { size: 31 }, mobile: { size: 19 } },
    };
    const current = structuredClone(p.blocks),
      applied = applyStudy(p, study);
    expect(applied.composition).toEqual(study.composition);
    for (const b of applied.blocks)
      expect(b).toEqual(current.find((w) => w.id === b.id));
  });
  it("removing content prunes geometry on both devices and study reconciliation never duplicates a source", () => {
    const p = fixture().pages[1],
      study = captureStudy(p, "Placed");
    const next = reconcileBlocks(
      p,
      p.blocks.filter((b) => b.id !== "a"),
    );
    expect(
      next.composition!.desktop[0].spatial!.frames.map((f) => f.blockId),
    ).toEqual(["b"]);
    expect(next.composition!.desktop[0].spatial!.layers).toEqual(["b"]);
    expect(
      applyStudy(next, study).composition!.desktop[0].spatial!.layers,
    ).toEqual(["b"]);
    expect(
      siteSchema.safeParse({ ...fixture(), pages: [fixture().pages[0], next] })
        .success,
    ).toBe(true);
  });
  it("explicit duplication remaps frame/layer IDs to new shared works", () => {
    const p = fixture().pages[1];
    let n = 0;
    const next = duplicateSection(p, "first", () => `copy-${n++}`),
      copy = next.composition!.desktop[1];
    expect(copy.blockIds).toEqual(["copy-0", "copy-1"]);
    expect(copy.spatial!.frames.map((f) => f.blockId)).toEqual(copy.blockIds);
    expect(copy.spatial!.layers).toEqual(["copy-1", "copy-0"]);
    expect(
      siteSchema.safeParse({ ...fixture(), pages: [fixture().pages[0], next] })
        .success,
    ).toBe(true);
    expect(next.composition!.desktop[0]).toEqual(p.composition!.desktop[0]);
  });
  it("active placement cannot be silently regrouped or changed by a flow alternative", () => {
    const p = fixture().pages[1];
    expect(planGrouping(p, ["a", "b"], "separate").ok).toBe(false);
    expect(
      planWorkDrop(p, ["c"], { kind: "into", sectionId: "first" }, false).ok,
    ).toBe(false);
    expect(ungroupSection(p, "first")).toEqual(p);
    expect(proposeArrangement(p, "first", "quiet")).toEqual(p);
    const flow = applyFlowSafely(p, "first");
    const regroup = planGrouping(flow, ["a", "b"], "separate");
    expect(regroup.ok).toBe(true);
    if (regroup.ok) {
      expect(
        siteSchema.safeParse({
          ...fixture(),
          pages: [fixture().pages[0], regroup.page],
        }).success,
      ).toBe(true);
      expect(regroup.page.studies!.at(-1)!.composition).toEqual(p.composition);
    }
  });
});
describe("v11 persistence and validation", () => {
  it("reads v10 without spatial defaults and preserves its exact stored record on first save", async () => {
    const s = fixture();
    delete s.pages[1].composition!.desktop[0].spatial;
    const old = { ...s, version: 10 },
      record = { value: old, revision: 7 },
      db = await database();
    await db.put("documents", record, "site");
    expect((await loadDocument())!.value).toEqual(s);
    expect(await db.get("documents", "site")).toEqual(record);
    await saveDocument(fixture(), 7);
    expect(await db.get("documents", "pre-spatial-sections")).toEqual(record);
    await expect(saveDocument(fixture(), 7)).rejects.toThrow("another window");
    expect(await db.get("documents", "pre-spatial-sections")).toEqual(record);
  });
  it("editable backup and recovery preserve active/dormant frames, layers and original records", async () => {
    const s = fixture();
    s.pages[1] = applyFlowSafely(s.pages[1], "first");
    const backup = await exportBackup(s),
      db = await database();
    expect(JSON.parse(backup).version).toBe(13);
    await importBackup(backup, 0);
    expect((await loadDocument())!.value).toEqual(s);
    const old = {
      ...s,
      version: 10,
      pages: s.pages.map((p) => ({
        ...p,
        studies: [],
        composition: p.composition
          ? {
              ...p.composition,
              desktop: p.composition.desktop.map(({ spatial, ...r }) => {
                void spatial;
                return r;
              }),
            }
          : null,
      })),
    };
    const raw = { value: old, revision: 6 };
    await db.put("documents", raw, "site");
    await importBackup(backup, 6);
    expect(await db.get("documents", "pre-spatial-sections")).toEqual(raw);
  });
  it("immutable revisions retain placement while live content changes; portable HTML/ZIP serialize validated geometry", async () => {
    const s = fixture();
    await saveDocument(s, 0);
    const r = await localRevisions.checkpoint(s, 1, "Placed");
    const changed = structuredClone(s);
    changed.pages[1].composition!.desktop[0].spatial!.frames[0].y = 800;
    await saveDocument(changed, 1);
    expect((await localRevisions.read("revision:" + r.id)).site).toEqual(s);
    const html = await portableHTML(r as Revision),
      zip = await portablePackage(r as Revision);
    expect(html).toContain('"spatial"');
    expect(html).toContain('"layers"');
    expect(zip.blob.size).toBeGreaterThan(100);
    expect(documentInput(s)).toEqual(s);
  });
  it.each([
    "missing-frame",
    "extra-frame",
    "duplicate-frame",
    "missing-layer",
    "duplicate-layer",
    "unknown-layer",
    "horizontal-overflow",
    "negative-y",
    "oversize",
    "unsupported-height",
    "unsupported-rotation",
  ])("rejects malformed spatial input: %s", (kind) => {
    const s = fixture(),
      p = s.pages[1].composition!.desktop[0].spatial!;
    if (kind === "missing-frame") p.frames.pop();
    if (kind === "extra-frame") p.frames.push({ ...p.frames[0], blockId: "c" });
    if (kind === "duplicate-frame") p.frames[1].blockId = "a";
    if (kind === "missing-layer") p.layers.pop();
    if (kind === "duplicate-layer") p.layers[1] = p.layers[0];
    if (kind === "unknown-layer") p.layers[0] = "missing";
    if (kind === "horizontal-overflow") p.frames[0].x = 80;
    if (kind === "negative-y") p.frames[0].y = -1;
    if (kind === "oversize") p.frames[0].width = 101;
    if (kind === "unsupported-height")
      Object.assign(p.frames[0], { height: 100 });
    if (kind === "unsupported-rotation") Object.assign(p, { rotation: 30 });
    expect(siteSchema.safeParse(s).success).toBe(false);
    expect(() => documentInput(s)).toThrow();
  });
});
