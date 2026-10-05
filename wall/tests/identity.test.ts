import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  initialSite,
  siteSchema,
  styleIds,
  defaultIdentity,
} from "../src/model";
import {
  patchIdentity,
  copyIdentityToAll,
  contrast,
  colorsFor,
  suggestedInk,
} from "../src/identity";
import { targetValue, updateTarget } from "../src/editing";
import { createSample, sampleIds } from "../src/samples";
import { databaseName, channelName, resolveWorkspace } from "../src/workspace";
import { createHistory, editHistory, undoHistory } from "../src/history";
import {
  database,
  saveDocument,
  loadDocument,
  exportBackup,
  importBackup,
} from "../src/storage";
const versionTwo = () => {
  const s = structuredClone(initialSite);
  const { copy, ...rest } = s;
  void copy;
  return {
    ...rest,
    version: 2,
    appearances: Object.fromEntries(
      Object.entries(s.appearances).map(([id, a]) => {
        const { identity, ...old } = a;
        void identity;
        return [id, old];
      }),
    ),
  };
};
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("identity migration and recovery", () => {
  it("preserves v2 authored content, navigation, media, order, focal points, and per-style choices", () => {
    const old = versionTwo();
    old.pages[1].blocks[0].focal = { x: 23, y: 82 };
    old.appearances.gallery.theme = "ink";
    const migrated = siteSchema.parse(old);
    expect(migrated.version).toBe(13);
    expect(migrated.pages).toEqual(old.pages);
    for (const id of styleIds) {
      expect(migrated.appearances[id]).toMatchObject(old.appearances[id]);
      expect(migrated.appearances[id].identity).toEqual(defaultIdentity);
    }
  });
  it("keeps the exact pre-identity record before the first save", async () => {
    const old = versionTwo(),
      db = await database();
    await db.put("documents", { value: old, revision: 8 }, "site");
    const migrated = await loadDocument();
    expect((await db.get("documents", "site"))?.value).toEqual(old);
    await saveDocument(
      patchIdentity(migrated.value, { canvas: "#ffffff", headingFont: "mono" }),
      8,
    );
    expect(await db.get("documents", "pre-identity-system")).toEqual({
      value: old,
      revision: 8,
    });
  });
  it("round trips current identity, custom composition copy, and content", async () => {
    const site = createSample("sora");
    site.copy.eyebrow = "An authored opening";
    const text = await exportBackup(site);
    expect(JSON.parse(text).version).toBe(13);
    const restored = await importBackup(text, 0);
    expect(restored.value).toEqual(site);
  });
  it("rejects malformed colours and out-of-range identity without replacing a saved draft", async () => {
    const loaded = await loadDocument();
    const bad = structuredClone(loaded.value);
    bad.appearances.folio.identity.canvas = "url(https://example.com)";
    await expect(saveDocument(bad, loaded.revision)).rejects.toThrow();
    expect((await loadDocument()).value).toEqual(loaded.value);
  });
});
describe("authorship and direct targeting", () => {
  it("edits a stable target without losing newer changes elsewhere", () => {
    const latest = { ...initialSite, tagline: "Newer practice" };
    const target = {
      kind: "page" as const,
      pageId: "quiet",
      field: "title" as const,
    };
    const changed = updateTarget(latest, target, "A title typed in place");
    expect(changed.tagline).toBe("Newer practice");
    expect(targetValue(changed, target)).toBe("A title typed in place");
    expect(initialSite.pages[1].title).toBe("The shape of quiet");
  });
  it("does not resurrect a target deleted while it was selected", () => {
    const latest = {
      ...initialSite,
      pages: initialSite.pages.filter((p) => p.id !== "quiet"),
    };
    expect(
      updateTarget(
        latest,
        { kind: "page", pageId: "quiet", field: "title" },
        "Late edit",
      ),
    ).toEqual(latest);
  });
  it("retains selected text across all four renderer choices", () => {
    let site = updateTarget(
      initialSite,
      { kind: "site", field: "closingText" },
      "This ending belongs to me.",
    );
    const pages = structuredClone(site.pages);
    for (const styleId of styleIds) {
      site = { ...site, styleId };
      expect(site.pages).toEqual(pages);
      expect(site.copy.closingText).toBe("This ending belongs to me.");
    }
  });
  it("keeps per-style identity choices and makes explicit apply-all undoable", () => {
    const selected = patchIdentity(
      { ...initialSite, styleId: "gallery" },
      { canvas: "#ffffff", headingFont: "mono", margin: 9 },
    );
    expect(selected.appearances.folio).toEqual(initialSite.appearances.folio);
    const all = copyIdentityToAll(selected);
    expect(all.pages).toEqual(initialSite.pages);
    for (const id of styleIds)
      expect(all.appearances[id].identity).toEqual(
        selected.appearances.gallery.identity,
      );
    expect(
      undoHistory(editHistory(createHistory(selected), all)).present,
    ).toEqual(selected);
  });
});
describe("isolated fictional studios and legibility", () => {
  it("assigns ten different database and notification namespaces, none the artist draft", () => {
    const names = sampleIds.map(databaseName),
      channels = sampleIds.map(channelName);
    expect(new Set(names).size).toBe(10);
    expect(names).not.toContain(databaseName(null));
    expect(channels).not.toContain(channelName(null));
    expect(resolveWorkspace("?demo=sora")).toBe("sora");
    expect(resolveWorkspace("?demo=../../draft")).toBeNull();
  });
  it("creates independently editable sample documents without changing a shared seed", () => {
    for (const id of sampleIds) {
      const sample = createSample(id);
      sample.name = "Edited example";
      sample.pages[0].title = "My words";
      expect(createSample(id).name).not.toBe("Edited example");
      expect(initialSite.pages[0].title).not.toBe("My words");
    }
  });
  it("supplies distinct authored content and ten working styles", () => {
    const samples = sampleIds.map(createSample);
    expect(new Set(samples.map((s) => s.styleId)).size).toBe(10);
    expect(new Set(samples.map((s) => s.pages[0].title)).size).toBe(10);
    samples.forEach((s) => expect(() => siteSchema.parse(s)).not.toThrow());
  });
  it("all supplied sample canvas/text and accent pairs meet the small-text contrast threshold", () => {
    for (const id of sampleIds) {
      const c = colorsFor(createSample(id));
      expect(contrast(c.canvas, c.ink)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.canvas, c.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("reports the authored low-contrast colours without silently replacing them", () => {
    const s = patchIdentity(initialSite, { canvas: "#ffffff", ink: "#eeeeee" });
    expect(colorsFor(s).ink).toBe("#eeeeee");
    expect(contrast("#ffffff", "#eeeeee")).toBeLessThan(4.5);
    expect(contrast("#ffffff", suggestedInk("#ffffff"))).toBeGreaterThan(4.5);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
  });
});
