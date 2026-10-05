import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteRenderer } from "../src/SiteRenderer";
import {
  initialSite,
  originalStyleIds,
  siteSchema,
  styleIds,
} from "../src/model";
import { createSample, sampleIds } from "../src/samples";
import { enableComposition, orderedSections } from "../src/composition";
import {
  database,
  loadDocument,
  saveDocument,
  exportBackup,
  importBackup,
} from "../src/storage";
import { patchIdentity, copyIdentityToAll } from "../src/identity";
import { targetValue, updateTarget } from "../src/editing";
import { availableDirections } from "../src/styles";
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
function v5() {
  const current = structuredClone(initialSite);
  return {
    ...current,
    version: 5,
    appearances: Object.fromEntries(
      originalStyleIds.map((id) => [id, current.appearances[id]]),
    ),
  };
}
describe("four-to-ten document and ownership contracts", () => {
  it("migrates version five without rewriting the saved draft, then retains its exact original on first edit", async () => {
    const old = v5();
    old.appearances.gallery.identity.canvas = "#e1e1e1";
    old.pages[1].blocks[0].focal = { x: 23, y: 82 };
    const db = await database();
    await db.put("documents", { value: old, revision: 12 }, "site");
    const loaded = await loadDocument();
    expect(loaded.value.version).toBe(13);
    expect(loaded.value.pages).toEqual(old.pages);
    for (const id of originalStyleIds)
      expect(loaded.value.appearances[id]).toEqual(old.appearances[id]);
    expect((await db.get("documents", "site"))?.value).toEqual(old);
    await saveDocument({ ...loaded.value, styleId: "poster" }, 12);
    expect(await db.get("documents", "pre-ten-directions")).toEqual({
      value: old,
      revision: 12,
    });
  });
  it("round-trips all ten identities, direct edits and an independent mobile order", async () => {
    let site = createSample("kai");
    const p = site.pages[1];
    p.composition = enableComposition(p).composition;
    p.composition!.mobile.reverse();
    const order = orderedSections(p.composition!, true).map((s) => s.id);
    for (const [i, id] of styleIds.entries()) {
      site = { ...site, styleId: id };
      site = patchIdentity(site, {
        headingScale: 80 + i * 4,
        margin: 3 + i / 2,
      });
      site = updateTarget(
        site,
        { kind: "page", pageId: p.id, field: "title" },
        "Authored across ten",
      );
      expect(
        targetValue(site, { kind: "page", pageId: p.id, field: "title" }),
      ).toBe("Authored across ten");
    }
    const backup = await exportBackup(site);
    const restored = await importBackup(backup, 0);
    expect(restored.value).toEqual(site);
    expect(
      orderedSections(restored.value.pages[1].composition!, true).map(
        (s) => s.id,
      ),
    ).toEqual(order);
    expect(Object.keys(copyIdentityToAll(site).appearances)).toHaveLength(10);
  });
  it("only offers implemented and registered directions and rejects unknown ones", () => {
    expect(availableDirections.map((d) => d.id)).toEqual([...styleIds]);
    expect(availableDirections.every((d) => d.status === "available")).toBe(
      true,
    );
    expect(
      siteSchema.safeParse({ ...initialSite, styleId: "invented" }).success,
    ).toBe(false);
  });
});
for (const id of sampleIds) {
  it(`${id}: preserves every source work through composed rendering and every style switch`, () => {
    const source = createSample(id),
      baseline = structuredClone(source.pages);
    for (const style of styleIds) {
      const switched = siteSchema.parse({ ...source, styleId: style });
      expect(switched.pages).toEqual(baseline);
    }
    for (const p of source.pages.filter((p) => p.kind !== "home")) {
      const site = structuredClone(source);
      site.pages = site.pages.map((q) =>
        q.id === p.id ? enableComposition(q) : q,
      );
      const html = renderToStaticMarkup(
        createElement(SiteRenderer, { site, pageId: p.id, navigate: () => {} }),
      );
      for (const b of p.blocks)
        expect(html).toContain(`data-composition-block="${b.id}"`);
    }
  });
}
for (const id of ["elena", "kai", "ada", "common", "lina", "remy"] as const) {
  it(`${id}: original layout renders every image, writing and film in source order`, () => {
    const site = createSample(id);
    for (const page of site.pages.filter((p) => p.kind !== "home")) {
      const html = renderToStaticMarkup(
        createElement(SiteRenderer, {
          site,
          pageId: page.id,
          navigate: () => {},
        }),
      );
      const locations = page.blocks.map((b) =>
        html.indexOf(`data-work-id="${b.id}"`),
      );
      expect(locations.every((n) => n >= 0)).toBe(true);
      expect([...locations].sort((a, b) => a - b)).toEqual(locations);
    }
  });
}
