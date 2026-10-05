import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  siteSchema,
  blankBlock,
  initialSite,
  type Site,
  type TypeOverrides,
} from "../src/model";
import { enableComposition, patchSection } from "../src/composition";
import {
  changeTypography,
  createTextStyle,
  patchType,
  typeFor,
  typeCSS,
  styleUsers,
  typographyAdvice,
} from "../src/typography";
import {
  applyStudy,
  captureStudy,
  proposeArrangement,
  resizeSection,
  ratioSection,
  widthPercent,
  columnRatio,
} from "../src/compositionStudies";
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
import { localRevisions, type Revision } from "../src/revisions";
import { portableHTML, portablePackage } from "../src/portable";
import { documentInput } from "../backend/validation";
const target = (blockId = "poem") => ({ pageId: "quiet", blockId });
const fixture = (): Site => {
  const s = structuredClone(initialSite);
  const p = s.pages.find((p) => p.id === "quiet")!;
  p.blocks = ["poem", "statement", "note", "echo"].map((id) => ({
    ...blankBlock("text"),
    id,
    text:
      id === "poem"
        ? "small words\n  keep their space\n\nand return"
        : "An authored " + id,
  }));
  s.pages = [s.pages[0], enableComposition(p)];
  return s;
};
const block = (s: Site, id = "poem") =>
  s.pages[1].blocks.find((b) => b.id === id)!;
const legacy = () => {
  const { textStyles, ...s } = fixture();
  void textStyles;
  return { ...s, version: 9 };
};
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("explicit text-style ownership", () => {
  it("inherits without emitting presentation declarations or changing historical words", () => {
    const s = fixture();
    expect(typeCSS(typeFor(s, block(s)))).toBeUndefined();
    const source = structuredClone(s);
    expect(siteSchema.parse(s)).toEqual(source);
  });
  it("creates distinct named poem, statement and note styles only on explicitly chosen works", () => {
    let s = fixture();
    for (const role of ["poem", "statement", "note"] as const)
      s = createTextStyle(s, target(role), role, role, role);
    expect(s.textStyles.map((t) => t.role)).toEqual([
      "poem",
      "statement",
      "note",
    ]);
    expect(new Set(s.textStyles.map((t) => t.base.size)).size).toBe(3);
    expect(block(s, "echo").typography).toBeUndefined();
    expect(block(s).text).toBe(block(fixture()).text);
    expect(siteSchema.parse(s)).toEqual(s);
  });
  it("updates reusable style subscribers without rewriting any work record or touching unsubscribed work", () => {
    let s = createTextStyle(fixture(), target(), "Verse", "poem", "verse");
    s = changeTypography(s, target("echo"), (t) => ({
      ...t,
      styleId: "verse",
    }));
    const before = structuredClone(s);
    s = patchType(s, target(), "verse", false, "size", 31);
    expect(styleUsers(s, "verse")).toBe(2);
    expect(s.pages).toEqual(before.pages);
    expect(typeFor(s, block(s)).size).toBe(31);
    expect(typeFor(s, block(s, "echo")).size).toBe(31);
    expect(typeCSS(typeFor(s, block(s, "statement")))).toBeUndefined();
  });
  it("resolves phone, style and work layers per property and resets to live inheritance", () => {
    let s = createTextStyle(fixture(), target(), "Verse", "poem", "verse");
    s = patchType(s, target(), "verse", true, "size", 18);
    s = patchType(s, target(), null, false, "size", 28);
    s = patchType(s, target(), null, true, "size", 21);
    expect(typeFor(s, block(s)).size).toBe(28);
    expect(typeFor(s, block(s), true).size).toBe(21);
    s = patchType(s, target(), null, true, "size", undefined);
    expect(typeFor(s, block(s), true).size).toBe(28);
    s = patchType(s, target(), null, false, "size", undefined);
    expect(typeFor(s, block(s), true).size).toBe(18);
    expect(typeFor(s, block(s)).size).toBe(24);
    s = changeTypography(s, target(), () => undefined);
    expect(block(s)).not.toHaveProperty("typography");
    expect(typeCSS(typeFor(s, block(s), true))).toBeUndefined();
  });
  it("shared content edit keeps phone typography, breaks and source casing", () => {
    let s = createTextStyle(fixture(), target(), "Verse", "poem", "verse");
    s = patchType(s, target(), null, true, "font", "mono");
    const next = updateTarget(
      s,
      { kind: "block", ...target(), field: "text" },
      "lower case\n  keeps indentation\n\nLast line",
    );
    expect(block(next).typography).toEqual(block(s).typography);
    expect(typeCSS(typeFor(next, block(next), true))).toMatchObject({
      whiteSpace: "pre-wrap",
      textTransform: "none",
    });
    expect(block(next).text).toBe(
      "lower case\n  keeps indentation\n\nLast line",
    );
  });
  it("named style, local edit and complete reset are exact undo/redo operations", () => {
    const a = fixture(),
      b = createTextStyle(a, target(), "Verse", "poem", "verse"),
      c = patchType(b, target(), null, true, "tracking", 0.1),
      d = changeTypography(c, target(), () => undefined);
    let h = editHistory(editHistory(editHistory(createHistory(a), b), c), d);
    for (const expected of [c, b, a]) {
      h = undoHistory(h);
      expect(h.present).toEqual(expected);
    }
    for (const expected of [b, c, d]) {
      h = redoHistory(h);
      expect(h.present).toEqual(expected);
    }
  });
  it("readability advice retains artist values", () => {
    const t: TypeOverrides = {
      size: 10,
      leading: 0.9,
      measure: 12,
      tracking: 0.3,
    };
    const before = structuredClone(t);
    expect(typographyAdvice(t)).toHaveLength(4);
    expect(t).toEqual(before);
    expect(typeCSS(t)?.fontSize).toBe("10px");
  });
});
describe("fine geometry and current typography in studies", () => {
  it.each([false, true])(
    "fine width and ratio on phone=%s retain other viewport and all authored content",
    (mobile) => {
      const s = fixture(),
        p = s.pages[1],
        device = mobile ? "mobile" : "desktop",
        other = mobile ? "desktop" : "mobile",
        id = p.composition![device][0].id;
      const next = patchSection(
        p,
        id,
        (g) => ratioSection(resizeSection(g, 83.7), 63.2),
        mobile,
      );
      expect(next.blocks).toBe(p.blocks);
      expect(next.composition![other]).toBe(p.composition![other]);
      expect(widthPercent(next.composition![device][0])).toBe(83.7);
      expect(columnRatio(next.composition![device][0])).toBe(63.2);
      expect(
        siteSchema.safeParse({ ...s, pages: [s.pages[0], next] }).success,
      ).toBe(true);
    },
  );
  it("study restores fine proportions while retaining latest style definitions, local overrides and text", () => {
    let s = createTextStyle(fixture(), target(), "Verse", "poem", "verse");
    const p = s.pages[1],
      id = p.composition!.desktop[0].id;
    const fine = patchSection(p, id, (g) =>
      ratioSection(resizeSection(g, 77.4), 57.6),
    );
    const study = captureStudy(fine, "Fine");
    s = patchType(s, target(), "verse", false, "size", 29);
    s = patchType(s, target(), null, true, "leading", 2.1);
    s = updateTarget(
      s,
      { kind: "block", ...target(), field: "text" },
      "Current words",
    );
    const restored = applyStudy(s.pages[1], study);
    expect(restored.composition).toEqual(fine.composition);
    expect(restored.blocks).toEqual(s.pages[1].blocks);
    expect(s.textStyles[0].base.size).toBe(29);
  });
  it("deterministic alternatives explicitly replace fine geometry without altering any text choices", () => {
    let s = createTextStyle(fixture(), target(), "Verse", "poem", "verse");
    const p = s.pages[1],
      id = p.composition!.desktop[0].id;
    const fine = patchSection(p, id, (g) =>
      ratioSection(resizeSection(g, 77.4), 57.6),
    );
    s = { ...s, pages: [s.pages[0], fine] };
    const next = proposeArrangement(fine, id, "quiet");
    expect(next.composition!.desktop[0]).not.toHaveProperty("widthPercent");
    expect(next.composition!.desktop[0]).not.toHaveProperty("columnRatio");
    expect(next.blocks).toEqual(fine.blocks);
    expect(next).toEqual(proposeArrangement(fine, id, "quiet"));
  });
});
describe("v10 migration and portable contracts", () => {
  it("pure v9 read keeps inherited layouts/blocks exactly; first save retains exact original and stale writers cannot replace recovery", async () => {
    const old = legacy(),
      record = { value: old, revision: 4 },
      db = await database();
    await db.put("documents", record, "site");
    const read = await loadDocument();
    expect(read.value.version).toBe(13);
    expect(read.value.pages).toEqual(old.pages);
    expect(read.value.textStyles).toEqual([]);
    expect(await db.get("documents", "site")).toEqual(record);
    await saveDocument({ ...read.value, name: "Edited" }, 4);
    expect(await db.get("documents", "pre-local-expression")).toEqual(record);
    await expect(saveDocument(read.value, 4)).rejects.toThrow("another window");
  });
  it("backup/recovery and raw historical release exports preserve exact original records", async () => {
    const old = legacy(),
      db = await database(),
      record = { value: old, revision: 2 };
    await db.put("documents", record, "site");
    let s = createTextStyle(fixture(), target(), "Verse", "poem", "verse");
    s = patchType(s, target(), null, true, "size", 17);
    s.pages[1] = patchSection(
      s.pages[1],
      s.pages[1].composition!.desktop[0].id,
      (g) => ratioSection(resizeSection(g, 78.3), 62.4),
    );
    const backup = await exportBackup(s);
    expect(JSON.parse(backup).version).toBe(13);
    expect((await importBackup(backup, 2)).value).toEqual(s);
    expect(await db.get("documents", "pre-local-expression")).toEqual(record);
    const release = {
      format: "latent-studio-revision",
      version: 1,
      id: "old-type",
      name: "Old",
      createdAt: "",
      sourceRevision: 2,
      site: old,
      assets: {},
      manifest: [],
    };
    await db.put(
      "documents",
      { value: release, revision: 2 },
      "revision:old-type",
    );
    const read = await localRevisions.read("revision:old-type");
    expect(read.site.pages).toEqual(old.pages);
    const html = await portableHTML(release as unknown as Revision);
    expect(
      JSON.parse(
        html.match(
          /<script id="latent-document" type="application\/json">(.*?)<\/script>/s,
        )![1],
      ).site.version,
    ).toBe(13);
    expect((await db.get("documents", "revision:old-type"))!.value).toEqual(
      release,
    );
    const current = { ...release, site: s } as Revision,
      publicHTML = await portableHTML(current),
      zip = await portablePackage(current, "original");
    const publicSite = JSON.parse(
      publicHTML.match(
        /<script id="latent-document" type="application\/json">(.*?)<\/script>/s,
      )![1],
    ).site;
    expect(publicSite.textStyles).toEqual(s.textStyles);
    expect(publicSite.pages[1].blocks).toEqual(s.pages[1].blocks);
    expect(zip.blob.size).toBeGreaterThan(1000);
  });
  it("backend accepts historical v9 and complete v10 declarations without weakening unknown-field validation", () => {
    const old = legacy();
    expect(documentInput(old).version).toBe(13);
    const s = createTextStyle(fixture(), target(), "Verse", "poem", "verse");
    expect(documentInput(s)).toEqual(s);
    expect(() => documentInput({ ...old, textStyles: s.textStyles })).toThrow(
      "Unknown document field",
    );
  });
  it.each([
    "orphan",
    "duplicate-id",
    "duplicate-name",
    "media-style",
    "size",
    "leading",
    "ratio",
    "width",
    "unknown",
  ] as const)("rejects invalid %s without guessing", (kind) => {
    const s = createTextStyle(fixture(), target(), "Verse", "poem", "verse");
    if (kind === "orphan") block(s).typography!.styleId = "missing";
    if (kind === "duplicate-id")
      s.textStyles.push({ ...s.textStyles[0], name: "Another" });
    if (kind === "duplicate-name")
      s.textStyles.push({ ...s.textStyles[0], id: "another", name: "VERSE" });
    if (kind === "media-style") block(s).type = "image";
    if (kind === "size") s.textStyles[0].base.size = 121;
    if (kind === "leading") s.textStyles[0].base.leading = 0.3;
    if (kind === "ratio") s.pages[1].composition!.desktop[0].columnRatio = 99;
    if (kind === "width") s.pages[1].composition!.mobile[0].widthPercent = 12;
    if (kind === "unknown")
      Object.assign(s.textStyles[0].base, {
        customFontURL: "https://example.invalid/font",
      });
    expect(siteSchema.safeParse(s).success).toBe(false);
    expect(() => documentInput(s)).toThrow();
  });
});
