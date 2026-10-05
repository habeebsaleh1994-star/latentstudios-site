import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initialSite, siteSchema } from "../src/model";
import {
  sectionFor,
  reconcileBlocks,
  duplicateSection,
} from "../src/composition";
import {
  proposeRelationships,
  applyRelationshipCandidate,
  explorationIntentions,
  type RelationshipRequest,
} from "../src/relationships";
import { intentionErrors, type Intention } from "../src/intentions";
import {
  captureStudy,
  applyStudy,
  publicWebsite,
} from "../src/compositionStudies";
import {
  database,
  loadDocument,
  saveDocument,
  exportBackup,
  importBackup,
} from "../src/storage";
import { localRevisions } from "../src/revisions";
import { documentInput } from "../backend/validation";
import { portableHTML, portablePackage } from "../src/portable";
import {
  createHistory,
  editHistory,
  undoHistory,
  redoHistory,
} from "../src/history";
const setup = () => {
  const site = structuredClone(initialSite),
    p = site.pages[1];
  const a = {
      ...p.blocks.find((b) => b.type === "image")!,
      id: "image",
      fit: "original" as const,
      focal: { x: 23, y: 67 },
    },
    b = {
      ...p.blocks.find((b) => b.type === "text")!,
      id: "writing",
      typography: {
        styleId: null,
        base: { size: 24, measure: 34 },
        mobile: { size: 18 },
      },
    };
  p.blocks = [b, a];
  p.composition = {
    enabled: true,
    desktop: [sectionFor([b.id, a.id], "d")],
    mobile: [sectionFor([b.id], "m1", true), sectionFor([a.id], "m2", true)],
  };
  p.composition.desktop[0].captions = [
    { blockId: a.id, size: 16, backing: "paper" },
  ];
  site.pages = [site.pages[0], p];
  return {
    site,
    p,
    q: {
      image: a.id,
      text: b.id,
      scope: "both",
      together: true,
      follows: true,
      remember: true,
      locked: [],
    } as RelationshipRequest,
  };
};
const relation = (
  from: string,
  to: string,
  kind: Intention["kind"] = "follows",
  scope: Intention["scope"] = "both",
  id = `${from}-${to}`,
): Intention => ({ id, from, to, kind, scope });
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("bounded relationship exploration", () => {
  it("creates three distinct responsive compositions with exact assets, text, crop, focal, type and identity", () => {
    const { site, p, q } = setup(),
      before = structuredClone(site),
      result = proposeRelationships(site, p, q, 1.5);
    expect(result.reasons).toEqual([]);
    expect(result.candidates).toHaveLength(3);
    expect(
      new Set(result.candidates.map((c) => JSON.stringify(c.page.composition)))
        .size,
    ).toBe(3);
    for (const c of result.candidates) {
      expect(c.page.blocks).toEqual([p.blocks[1], p.blocks[0]]);
      expect(c.page.composition!.desktop[0].captions).toEqual(
        p.composition!.desktop[0].captions,
      );
      expect(c.page.composition!.mobile[0].blockIds).toEqual([
        "image",
        "writing",
      ]);
      expect(
        siteSchema.safeParse({ ...site, pages: [site.pages[0], c.page] })
          .success,
      ).toBe(true);
    }
    expect(site).toEqual(before);
  });
  it("uses aspect ratio, text length and named/local measure without mutating metadata", () => {
    const { site, p, q } = setup();
    const wide = proposeRelationships(site, p, q, 2.2),
      portrait = proposeRelationships(site, p, q, 0.6);
    expect(
      wide.candidates[0].page.composition!.desktop[0].columnRatio,
    ).not.toBe(portrait.candidates[0].page.composition!.desktop[0].columnRatio);
    const lengthy = structuredClone(p);
    lengthy.blocks[0].text = "A long essay ".repeat(300);
    expect(
      proposeRelationships(site, lengthy, q, 2).candidates[1].page.composition!
        .desktop[0].columnRatio,
    ).toBeLessThanOrEqual(64);
  });
  it.each(["desktop", "mobile"] as const)(
    "changes only the explicit %s scope",
    (scope) => {
      const { site, p, q } = setup();
      q.scope = scope;
      const next = proposeRelationships(site, p, q, 1).candidates[0].page;
      expect(
        next.composition![scope === "desktop" ? "mobile" : "desktop"],
      ).toEqual(p.composition![scope === "desktop" ? "mobile" : "desktop"]);
      if (scope === "mobile") expect(next.blocks).toEqual(p.blocks);
    },
  );
  it("does not invent a follows intention when the artist only chooses together", () => {
    const { site, p, q } = setup();
    q.follows = false;
    const next = proposeRelationships(site, p, q, 1).candidates[0].page;
    expect(next.blocks).toEqual(p.blocks);
    expect(next.intentions?.every((r) => r.kind === "together")).toBe(true);
  });
  it("keeps exploration-only intentions out of the document and preserves unaffected scope", () => {
    const { site, p, q } = setup();
    p.intentions = [relation("image", "writing", "together")];
    q.scope = "desktop";
    const rules = explorationIntentions(p, q);
    expect(
      rules.some((r) => r.scope === "mobile" && r.kind === "together"),
    ).toBe(true);
    q.remember = false;
    expect(
      proposeRelationships(site, p, q, 1).candidates[0].page.intentions,
    ).toEqual(p.intentions);
  });
  it("explains conflicting placement holds without changing or silently relaxing them", () => {
    const { site, p, q } = setup();
    q.locked = ["image"];
    const r = proposeRelationships(site, p, q, 1);
    expect(r.candidates).toEqual([]);
    expect(r.reasons.join(" ")).toContain("placement conflicts");
  });
  it("rejects stale candidates, applies atomically with a prior study and supports one Undo/Redo", () => {
    const { site, p, q } = setup(),
      next = applyRelationshipCandidate(site, p, p, q, 1, "emphasis");
    expect(next.studies!.at(-1)!.composition).toEqual(p.composition);
    const nextSite = { ...site, pages: [site.pages[0], next] },
      h = editHistory(createHistory(site), nextSite);
    expect(undoHistory(h).present).toEqual(site);
    expect(redoHistory(undoHistory(h)).present).toEqual(nextSite);
    const edited = {
      ...p,
      blocks: p.blocks.map((b) =>
        b.id === "writing" ? { ...b, text: "Updated" } : b,
      ),
    };
    expect(() =>
      applyRelationshipCandidate(site, edited, p, q, 1, "balance"),
    ).toThrow("changed");
  });
  it("keeps dormant placement in one spatial group but explains unsafe cross-group spatial merging", () => {
    const { site, p, q } = setup();
    q.scope = "desktop";
    p.composition!.desktop[0].spatial = {
      enabled: true,
      minHeight: 500,
      frames: p.blocks.map((b) => ({ blockId: b.id, x: 0, y: 0, width: 50 })),
      layers: p.blocks.map((b) => b.id),
    };
    const next = proposeRelationships(site, p, q, 1).candidates[0].page;
    expect(next.composition!.desktop[0].spatial).toEqual({
      ...p.composition!.desktop[0].spatial,
      enabled: false,
    });
    p.composition!.desktop.push(sectionFor(["extra"], "extra"));
    p.blocks.push({ ...p.blocks[0], id: "extra" });
    q.text = "extra";
    expect(proposeRelationships(site, p, q, 1).reasons.join(" ")).toContain(
      "Flow",
    );
  });
  it("explains nonadjacent sections, oversize groups, missing selections and missing media measurements", () => {
    const { site, p, q } = setup();
    q.scope = "mobile";
    const middle = { ...p.blocks[0], id: "middle" };
    p.blocks.push(middle);
    p.composition!.desktop.push(sectionFor([middle.id], "other"));
    p.composition!.mobile.splice(1, 0, sectionFor([middle.id], "middle", true));
    expect(proposeRelationships(site, p, q, 1).reasons.join(" ")).toContain(
      "another section",
    );
    expect(
      proposeRelationships(site, p, { ...q, text: "missing" }, 1).candidates,
    ).toHaveLength(0);
    expect(proposeRelationships(site, p, q, 0).reasons.join(" ")).toContain(
      "image must load",
    );
  });
  it("retains current source updates, prunes deleted references, and reconciles old studies", () => {
    const { site, p, q } = setup(),
      next = proposeRelationships(site, p, q, 1).candidates[0].page,
      study = captureStudy(next, "Pair");
    const updated = {
      ...next,
      blocks: next.blocks.map((b) => ({ ...b, text: "Later words" })),
    };
    expect(
      applyStudy(updated, study).blocks.every((b) => b.text === "Later words"),
    ).toBe(true);
    const deleted = reconcileBlocks(
      updated,
      updated.blocks.filter((b) => b.id !== "image"),
    );
    expect(deleted.intentions).toEqual([]);
    expect(applyStudy(deleted, study).intentions).toEqual([]);
    expect(
      siteSchema.safeParse({ ...site, pages: [site.pages[0], deleted] })
        .success,
    ).toBe(true);
    let n = 0;
    const copied = duplicateSection(
      next,
      next.composition!.desktop[0].id,
      () => `copy${n++}`,
    );
    expect(copied.intentions).toEqual(next.intentions); // no invented intent on copies
  });
});
describe("intention validation and durable v13 recovery", () => {
  it.each(["missing", "self", "cycle", "branch", "duplicate", "overlap"])(
    "rejects %s without silent normalization",
    (kind) => {
      const { site, p } = setup();
      let rules = [relation("image", "writing")];
      if (kind === "missing") rules = [relation("image", "missing")];
      if (kind === "self") rules = [relation("image", "image")];
      if (kind === "cycle") rules.push(relation("writing", "image"));
      if (kind === "branch")
        rules.push(relation("image", "image", "follows", "desktop", "other"));
      if (kind === "duplicate") rules.push({ ...rules[0] });
      if (kind === "overlap")
        rules.push(relation("image", "writing", "follows", "desktop", "other"));
      p.intentions = rules;
      expect(
        intentionErrors(
          rules,
          p.blocks.map((b) => b.id),
        ).length,
      ).toBeGreaterThan(0);
      expect(siteSchema.safeParse(site).success).toBe(false);
      expect(() => documentInput(site)).toThrow();
    },
  );
  it("refuses intentions labelled as an old document", () => {
    const { site, p } = setup();
    p.intentions = [relation("image", "writing")];
    expect(siteSchema.safeParse({ ...site, version: 12 }).success).toBe(false);
  });
  it("leaves v12 bytes alone on load and atomically keeps the exact original before first save", async () => {
    const { site } = setup(),
      raw = { value: { ...site, version: 12 }, revision: 3 },
      db = await database();
    await db.put("documents", raw, "site");
    const loaded = await loadDocument();
    expect(loaded.value.version).toBe(13);
    expect(loaded.value.pages).toEqual(site.pages);
    expect(await db.get("documents", "site")).toEqual(raw);
    await saveDocument(loaded.value, 3);
    expect(await db.get("documents", "pre-relationships")).toEqual(raw);
    await expect(saveDocument(loaded.value, 3)).rejects.toThrow();
    expect(await db.get("documents", "pre-relationships")).toEqual(raw);
  });
  it("keeps editable intentions through backup/import/revisions, excluding them only from public deliveries", async () => {
    const { site, p, q } = setup();
    site.pages[1] = proposeRelationships(site, p, q, 1).candidates[0].page;
    // Media-less frozen test documents isolate metadata transport; real original files are covered in browser exports.
    site.pages[1].blocks.forEach((b) => {
      b.assetId = "";
      b.type = "text";
      delete b.typography;
    });
    const raw = {
        value: { ...structuredClone(initialSite), version: 12 },
        revision: 1,
      },
      db = await database();
    await db.put("documents", raw, "site");
    const backup = await exportBackup(site);
    expect(JSON.parse(backup).version).toBe(13);
    await importBackup(backup, 1);
    expect((await loadDocument()).value).toEqual(site);
    expect(await db.get("documents", "pre-relationships")).toEqual(raw);
    const revision = await localRevisions.checkpoint(site, 2, "Pair");
    expect(revision.site).toEqual(site);
    expect(documentInput(site)).toEqual(site);
    expect(publicWebsite(site).pages[1].intentions).toBeUndefined();
    const html = await portableHTML(revision),
      zip = await portablePackage(revision);
    expect(html).not.toContain('"intentions"');
    expect(zip.blob.size).toBeGreaterThan(100);
    await saveDocument({ ...site, name: "Later" }, 2);
    await localRevisions.restore(`revision:${revision.id}`, 3);
    expect((await loadDocument()).value.pages).toEqual(site.pages);
  });
});
