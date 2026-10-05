import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import { siteSchema } from "../src/model";
import { sectionFor } from "../src/composition";
import { planGrouping, readingOrder, selectionRange } from "../src/regrouping";
import {
  proposeArrangement,
  captureStudy,
  applyStudy,
  publicWebsite,
} from "../src/compositionStudies";
import {
  createHistory,
  editHistory,
  undoHistory,
  redoHistory,
} from "../src/history";
import { database, exportBackup, importBackup } from "../src/storage";
import { portableHTML, portablePackage } from "../src/portable";
import type { Revision } from "../src/revisions";
import { fixturePage as source, fixtureSite as site } from "./viewportFixtures";
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("independent grouping locks only its chosen viewport", () => {
  it.each([false, true])(
    "regroups across boundaries on mobile=%s without the other viewport vetoing",
    (mobile) => {
      const p = source(),
        ids = mobile ? ["a", "c"] : ["b", "c", "d"],
        plan = planGrouping(p, ids, "group", "new", mobile);
      expect(plan.ok).toBe(true);
      if (!plan.ok) throw Error(plan.reason);
      expect(plan.page.blocks).toEqual(p.blocks);
      expect(readingOrder(plan.page, mobile)).toEqual(readingOrder(p, mobile));
      expect(plan.page.composition![mobile ? "desktop" : "mobile"]).toBe(
        p.composition![mobile ? "desktop" : "mobile"],
      );
      expect(
        plan.page.composition![mobile ? "mobile" : "desktop"].some(
          (s) => s.blockIds.join() === ids.join(),
        ),
      ).toBe(true);
      expect(siteSchema.safeParse(site(plan.page)).success).toBe(true);
    },
  );
  it("separates only selected members and keeps unselected companions together", () => {
    const p = source(),
      plan = planGrouping(p, ["c"], "separate", "new");
    if (!plan.ok) throw Error(plan.reason);
    expect(plan.page.composition!.desktop.map((s) => s.blockIds)).toEqual([
      ["a", "b"],
      ["c"],
      ["d", "e"],
      ["f"],
    ]);
    expect(plan.page.composition!.mobile).toBe(p.composition!.mobile);
  });
  it("separates a reversed phone group without changing desktop membership or phone reading", () => {
    const p = source();
    p.composition!.mobile = [
      sectionFor(["b", "a"], "phone-pair", true),
      ...["c", "d", "e", "f"].map((id) => sectionFor([id], id, true)),
    ];
    const plan = planGrouping(p, ["a", "b"], "separate", "split", true);
    if (!plan.ok) throw Error(plan.reason);
    expect(readingOrder(plan.page, true)).toEqual(readingOrder(p, true));
    expect(plan.page.composition!.desktop).toBe(p.composition!.desktop);
    expect(plan.page.blocks).toBe(p.blocks);
  });
  it.each([false, true])(
    "rejects gaps only in selected mobile=%s order",
    (mobile) => {
      const p = source(),
        snapshot = structuredClone(p),
        plan = planGrouping(
          p,
          mobile ? ["a", "b"] : ["a", "c"],
          "group",
          "new",
          mobile,
        );
      expect(plan).toMatchObject({
        ok: false,
        reason: expect.stringContaining(
          mobile ? "phone reading order" : "desktop reading order",
        ),
      });
      expect(p).toEqual(snapshot);
    },
  );
  it("arbitrary phone permutations never veto valid desktop regrouping", () => {
    for (const order of [
      ["a", "c", "b", "e", "d", "f"],
      ["f", "e", "d", "c", "b", "a"],
      ["b", "f", "a", "c", "d", "e"],
    ])
      for (let start = 0; start < 5; start++)
        for (let size = 2; size <= 4 && start + size <= 6; size++) {
          const p = source();
          p.composition!.desktop = p.blocks.map((b) =>
            sectionFor([b.id], b.id),
          );
          p.composition!.mobile = order.map((id) => sectionFor([id], id, true));
          const plan = planGrouping(
            p,
            p.blocks.slice(start, start + size).map((b) => b.id),
            "group",
            "new",
          );
          expect(plan.ok).toBe(true);
          if (!plan.ok) throw Error(plan.reason);
          expect(plan.page.composition!.mobile).toEqual(p.composition!.mobile);
          expect(plan.page.blocks).toEqual(p.blocks);
          expect(siteSchema.safeParse(site(plan.page)).success).toBe(true);
        }
  });
  it.each([
    [],
    ["a"],
    ["a", "a"],
    ["a", "missing"],
    ["a", "b", "c", "d", "e"],
    ["a", "b"],
  ])("rejects invalid/already grouped selection %j", (...ids) => {
    expect(planGrouping(source(), ids, "group").ok).toBe(false);
  });
  it("supports reading-order range selection on each device", () => {
    const p = source();
    expect(selectionRange(p, "a", "b", true)).toEqual(["a", "c", "b"]);
    expect(selectionRange(p, "b", "a", false)).toEqual(["a", "b"]);
  });
  it("phone regroup is one Undo; studies restore both layouts with latest shared words", () => {
    const p = source(),
      plan = planGrouping(p, ["a", "c"], "group", "phone-new", true);
    if (!plan.ok) throw Error(plan.reason);
    const h = editHistory(createHistory(site(p)), site(plan.page));
    expect(undoHistory(h).present).toEqual(site(p));
    expect(redoHistory(undoHistory(h)).present).toEqual(site(plan.page));
    const study = captureStudy(plan.page, "Independent"),
      edited = {
        ...p,
        blocks: p.blocks.map((b) => ({
          ...b,
          text: "Current shared text",
          caption: "Current caption",
        })),
      };
    const applied = applyStudy(edited, study);
    expect(applied.composition).toEqual(plan.page.composition);
    expect(applied.blocks.every((b) => b.text === "Current shared text")).toBe(
      true,
    );
  });
});
describe("device alternatives and public contracts", () => {
  it.each(["balanced", "leading", "quiet"] as const)(
    "applies deterministic %s only to selected phone geometry",
    (option) => {
      const p = source(),
        next = proposeArrangement(p, "phone-a", option, true);
      expect(next.blocks).toBe(p.blocks);
      expect(next.composition!.desktop).toBe(p.composition!.desktop);
      expect(next.composition!.mobile.slice(1)).toEqual(
        p.composition!.mobile.slice(1),
      );
      expect(readingOrder(next, true)).toEqual(readingOrder(p, true));
      expect(next).toEqual(proposeArrangement(p, "phone-a", option, true));
      expect(siteSchema.safeParse(site(next)).success).toBe(true);
    },
  );
  it("retains independent groups through v9 backup and both exports, excluding private studies", async () => {
    const p = source();
    p.studies = [captureStudy(p, "Private mobile study")];
    const document = site(p),
      backup = await exportBackup(document);
    expect(JSON.parse(backup).version).toBe(13);
    expect((await importBackup(backup, 0)).value).toEqual(document);
    const revision: Revision = {
      format: "latent-studio-revision",
      version: 1,
      id: "grouped",
      name: "Grouped edition",
      createdAt: "",
      sourceRevision: 1,
      site: document,
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
    expect(data.site).toEqual(publicWebsite(document));
    expect(html).not.toContain("Private mobile study");
    expect(await folder.blob.text()).not.toContain("Private mobile study");
  });
});
