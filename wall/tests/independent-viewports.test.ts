import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import { siteSchema, blankBlock, type Site } from "../src/model";
import {
  sectionFor,
  duplicateSection,
  removeSection,
  reconcileBlocks,
} from "../src/composition";
import { readingOrder, planGrouping } from "../src/regrouping";
import { captureStudy, applyStudy } from "../src/compositionStudies";
import {
  database,
  loadDocument,
  saveDocument,
  exportBackup,
  importBackup,
} from "../src/storage";
import { localRevisions, type Revision } from "../src/revisions";
import { portableHTML, portablePackage } from "../src/portable";
import { documentInput } from "../backend/validation";
import { fixturePage, fixtureSite, legacySite } from "./viewportFixtures";
const historical = () => {
  const p = fixturePage();
  p.composition!.mobile = p.composition!.desktop.map((s) => ({
    ...sectionFor([...s.blockIds], `mobile-${s.id}`, true),
    align: s.align,
    vertical: s.vertical,
  }));
  return legacySite(fixtureSite(p));
};
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("v9 lossless migration", () => {
  it("retains authored records and exact old geometry across permutations, reversals, enabled and disabled layouts", () => {
    for (const order of [
      ["first", "second", "last"],
      ["last", "second", "first"],
      ["second", "first", "last"],
    ])
      for (let mask = 0; mask < 8; mask++)
        for (const enabled of [true, false]) {
          const old = historical(),
            c = old.pages[1].composition!;
          c.enabled = enabled;
          c.mobileOrder = order;
          c.sections.forEach((s, i) => {
            s.mobile.reverse = Boolean(mask & (1 << i));
            s.mobile.layout = i === 1 ? "columns" : "stack";
            s.mobile.width = i === 1 ? "inset" : "full";
            s.mobile.gap = 8 + i * 12;
            s.mobile.space = 12 + i * 36;
            s.align = i === 1 ? "right" : "left";
            s.vertical = "end";
            s.width = i === 1 ? "reading" : "wide";
            s.gap = 16 + i * 20;
            s.space = 40 + i * 50;
          });
          const original = structuredClone(old),
            next = siteSchema.parse(old),
            p = next.pages[1];
          expect(old).toEqual(original);
          expect(p.blocks).toEqual(old.pages[1].blocks);
          expect(p.composition!.enabled).toBe(enabled);
          expect(p.composition!.desktop).toEqual(
            c.sections.map(({ mobile, ...s }) => {
              void mobile;
              return s;
            }),
          );
          expect(p.composition!.mobile).toEqual(
            order.map((id) => {
              const s = c.sections.find((s) => s.id === id)!;
              return {
                id: `mobile-${id}`,
                blockIds: s.mobile.reverse
                  ? [...s.blockIds].reverse()
                  : s.blockIds,
                layout: s.mobile.layout,
                width: s.mobile.width,
                gap: s.mobile.gap,
                space: s.mobile.space,
                align: s.align,
                vertical: s.vertical,
              };
            }),
          );
          expect(siteSchema.parse(next)).toEqual(next);
        }
  });
  it("migrates historical studies as independent snapshots without touching live content", () => {
    const old = historical(),
      p = old.pages[1];
    p.studies = [
      {
        id: "historical-study",
        name: "Old arrangement",
        createdAt: "2026-01-01",
        order: p.blocks.map((b) => b.id),
        composition: structuredClone(p.composition),
      },
    ];
    p.studies[0].composition!.mobileOrder = ["last", "first", "second"];
    p.studies[0].composition!.sections[0].mobile.reverse = true;
    const next = siteSchema.parse(old),
      study = next.pages[1].studies![0],
      edited = {
        ...next.pages[1],
        blocks: next.pages[1].blocks.map((b) => ({
          ...b,
          text: "Current B",
          caption: "Current caption",
        })),
      };
    const applied = applyStudy(edited, study);
    expect(readingOrder(applied, true)).toEqual(["f", "b", "a", "c", "d", "e"]);
    expect(applied.blocks.every((b) => b.text === "Current B")).toBe(true);
    expect(siteSchema.safeParse(fixtureSite(applied)).success).toBe(true);
  });
  it.each([
    "missing",
    "repeat",
    "foreign-order",
    "duplicate-order",
    "duplicate-group",
    "desktop-reorder",
  ] as const)("rejects malformed historical %s instead of guessing", (kind) => {
    const old = historical(),
      c = old.pages[1].composition!;
    if (kind === "missing") c.sections.pop();
    if (kind === "repeat") c.sections[1].blockIds[0] = "a";
    if (kind === "foreign-order") c.mobileOrder = ["unknown"];
    if (kind === "duplicate-order") c.mobileOrder = ["first", "first", "last"];
    if (kind === "duplicate-group") c.sections[1].id = "first";
    if (kind === "desktop-reorder") c.sections.reverse();
    expect(siteSchema.safeParse(old).success).toBe(false);
    expect(() => documentInput(old)).toThrow();
  });
  it.each(["desktop", "mobile"] as const)(
    "rejects unsupported duplicate/missing work occurrences in %s",
    (device) => {
      for (const mutate of [
        (s: Site) => s.pages[1].composition![device].pop(),
        (s: Site) => s.pages[1].composition![device][0].blockIds.push("a"),
        (s: Site) =>
          s.pages[1].composition![device][0].blockIds.splice(0, 1, "unknown"),
        (s: Site) => {
          s.pages[1].composition![device][1].id =
            s.pages[1].composition![device][0].id;
        },
      ]) {
        const s = fixtureSite(fixturePage());
        mutate(s);
        expect(siteSchema.safeParse(s).success).toBe(false);
        expect(() => documentInput(s)).toThrow();
      }
    },
  );
  it("reads without writes; first save atomically retains exact historical record and stale writers cannot replace it", async () => {
    const old = historical(),
      db = await database(),
      record = { value: old, revision: 14 };
    await db.put("documents", record, "site");
    const loaded = await loadDocument();
    expect(await db.get("documents", "site")).toEqual(record);
    expect(
      await db.get("documents", "pre-independent-viewports"),
    ).toBeUndefined();
    await saveDocument({ ...loaded.value, name: "Edited" }, 14);
    expect(await db.get("documents", "pre-independent-viewports")).toEqual(
      record,
    );
    await expect(saveDocument(loaded.value, 14)).rejects.toThrow(
      "another window",
    );
    await saveDocument(loaded.value, 15);
    expect(await db.get("documents", "pre-independent-viewports")).toEqual(
      record,
    );
  });
  it("historical backup import preserves exact displaced draft and v9 export roundtrips both arrangements", async () => {
    const db = await database(),
      old = historical();
    await db.put("documents", { value: old, revision: 3 }, "site");
    const imported = await importBackup(
      JSON.stringify({
        format: "latent-studio-backup",
        version: 8,
        site: old,
        assets: {},
      }),
      3,
    );
    expect(imported.value).toEqual(siteSchema.parse(old));
    expect(
      (await db.get("documents", "pre-independent-viewports"))!.value,
    ).toEqual(old);
    const independent = fixtureSite(fixturePage());
    const text = await exportBackup(independent);
    expect((await importBackup(text, 4)).value).toEqual(independent);
  });
  it("reads and exports immutable historical releases without rewriting stored bytes", async () => {
    const old = historical(),
      db = await database(),
      revision = {
        format: "latent-studio-revision",
        version: 1,
        id: "historical",
        name: "Old",
        createdAt: "",
        sourceRevision: 2,
        site: old,
        assets: {},
        manifest: [],
      };
    const record = { value: revision, revision: 2 };
    await db.put("documents", record, "revision:historical");
    const read = await localRevisions.read("revision:historical");
    expect(read.site).toEqual(siteSchema.parse(old));
    expect(await db.get("documents", "revision:historical")).toEqual(record);
    const html = await portableHTML(revision as unknown as Revision),
      zip = await portablePackage(revision as unknown as Revision, "original");
    const data = JSON.parse(
      html.match(
        /<script id="latent-document" type="application\/json">(.*?)<\/script>/s,
      )![1],
    );
    expect(data.site.version).toBe(13);
    expect(data.site.pages[1].composition).toEqual(
      read.site.pages[1].composition,
    );
    expect(zip.blob.size).toBeGreaterThan(1000);
    expect(await db.get("documents", "revision:historical")).toEqual(record);
  });
  it("backend accepts validated v8 and v9 but rejects unknown legacy and new arrangement fields", () => {
    const old = historical();
    old.pages.forEach((p) => p.blocks.forEach((b) => (b.assetId = "")));
    expect(documentInput(old)).toEqual(siteSchema.parse(old));
    const s = fixtureSite(fixturePage());
    s.pages.forEach((p) => p.blocks.forEach((b) => (b.assetId = "")));
    expect(documentInput(s)).toEqual(s);
    expect(() => documentInput({ ...old, unexpected: 1 })).toThrow(
      "Unknown document field",
    );
    expect(() =>
      documentInput({
        ...s,
        pages: s.pages.map((p) => ({
          ...p,
          composition: p.composition
            ? { ...p.composition, mobileOrder: null }
            : null,
        })),
      }),
    ).toThrow();
  });
});
describe("shared works with independent group ownership", () => {
  it.each([false, true])(
    "duplicates new work IDs into both layouts from mobile=%s, without aliasing old occurrences",
    (mobile) => {
      const p = fixturePage(),
        key = p.composition![mobile ? "mobile" : "desktop"][0].id,
        oldDesktop = structuredClone(p.composition!.desktop),
        oldPhone = structuredClone(p.composition!.mobile);
      let n = 0;
      const next = duplicateSection(p, key, () => `copy-${n++}`, mobile);
      expect(next.blocks.length).toBeGreaterThan(p.blocks.length);
      expect(siteSchema.safeParse(fixtureSite(next)).success).toBe(true);
      for (const b of p.blocks)
        expect(next.blocks.find((x) => x.id === b.id)).toEqual(b);
      expect(
        next.composition![mobile ? "desktop" : "mobile"].slice(
          0,
          mobile ? oldDesktop.length : oldPhone.length,
        ),
      ).toEqual(mobile ? oldDesktop : oldPhone);
    },
  );
  it.each([false, true])(
    "deletes selected shared content on mobile=%s while retaining other survivors",
    (mobile) => {
      const p = fixturePage(),
        group = p.composition![mobile ? "mobile" : "desktop"][0],
        next = removeSection(p, group.id, mobile);
      expect(next.blocks.map((b) => b.id)).toEqual(
        p.blocks.filter((b) => !group.blockIds.includes(b.id)).map((b) => b.id),
      );
      expect(siteSchema.safeParse(fixtureSite(next)).success).toBe(true);
      for (const device of ["desktop", "mobile"] as const)
        expect(
          next.composition![device].flatMap((s) => s.blockIds).sort(),
        ).toEqual(next.blocks.map((b) => b.id).sort());
    },
  );
  it("new content appends singletons independently; applying old studies retains it with new content", () => {
    const p = fixturePage(),
      study = captureStudy(p, "Old"),
      added = {
        ...blankBlock("text"),
        id: "new-work",
        text: "New shared work",
      },
      next = reconcileBlocks(p, [...p.blocks, added]);
    for (const device of ["desktop", "mobile"] as const) {
      expect(next.composition![device].slice(0, -1)).toEqual(
        p.composition![device],
      );
      expect(next.composition![device].at(-1)!.blockIds).toEqual(["new-work"]);
    }
    const applied = applyStudy(next, study);
    expect(applied.blocks.at(-1)).toEqual(added);
    expect(siteSchema.safeParse(fixtureSite(applied)).success).toBe(true);
  });
  it("desktop A+B remains while phone A,C,B regroup and separate are independently undoable", () => {
    const p = fixturePage(),
      plan = planGrouping(p, ["a", "c"], "group", "phone-ac", true);
    if (!plan.ok) throw Error(plan.reason);
    expect(plan.page.composition!.desktop).toBe(p.composition!.desktop);
    expect(plan.page.composition!.mobile[0].blockIds).toEqual(["a", "c"]);
    const separate = planGrouping(
      plan.page,
      ["a", "c"],
      "separate",
      "phone-split",
      true,
    );
    if (!separate.ok) throw Error(separate.reason);
    expect(separate.page.composition!.desktop).toBe(p.composition!.desktop);
    expect(readingOrder(separate.page, true)).toEqual(readingOrder(p, true));
  });
});
