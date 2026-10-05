import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import { initialSite, siteSchema, styleIds } from "../src/model";
import {
  createHistory,
  editHistory,
  undoHistory,
  redoHistory,
} from "../src/history";
import { SaveQueue } from "../src/SaveQueue";
import {
  database,
  loadDocument,
  saveDocument,
  importBackup,
  readAsset,
} from "../src/storage";
function legacyFixture() {
  const s = structuredClone(initialSite);
  return {
    version: 1,
    name: "Preserved artist",
    tagline: s.tagline,
    email: s.email,
    styleId: "folio",
    theme: "ink",
    typography: "modern",
    spacing: 120,
    pages: s.pages.map((p) => ({
      ...p,
      blocks: p.blocks.map((b) => {
        const copy: Partial<typeof b> = { ...b };
        delete copy.focal;
        return copy;
      }),
    })),
  };
}
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("edition-one migration", () => {
  it("preserves every authored value and identity while filling new defaults", () => {
    const old = legacyFixture();
    const result = siteSchema.parse(old);
    expect(result.version).toBe(13);
    expect(result.name).toBe(old.name);
    expect(result.appearances.folio).toMatchObject({
      theme: "ink",
      typography: "modern",
      spacing: 120,
    });
    expect(result.pages.map((p) => p.id)).toEqual(old.pages.map((p) => p.id));
    for (let i = 0; i < old.pages.length; i++)
      for (let j = 0; j < old.pages[i].blocks.length; j++) {
        expect(result.pages[i].blocks[j]).toEqual({
          ...old.pages[i].blocks[j],
          focal: { x: 50, y: 50 },
        });
      }
  });
  it("does not rewrite a legacy record on read; saves an exact recovery copy on first edit", async () => {
    const old = legacyFixture();
    const db = await database();
    await db.put("documents", { value: old, revision: 7 }, "site");
    const loaded = await loadDocument();
    expect(loaded.revision).toBe(7);
    expect((await db.get("documents", "site"))!.value).toEqual(old);
    await saveDocument({ ...loaded.value, name: "New name" }, 7);
    expect(await db.get("documents", "pre-edition-two")).toEqual({
      value: old,
      revision: 7,
    });
    expect((await loadDocument()).value.name).toBe("New name");
  });
  it("imports an edition-one backup without changing its authored content", async () => {
    const old = legacyFixture();
    const restored = await importBackup(
      JSON.stringify({
        format: "latent-studio-backup",
        version: 1,
        site: old,
        assets: {},
      }),
      0,
    );
    expect(restored.value.name).toBe(old.name);
    expect(restored.value.appearances.folio.theme).toBe("ink");
  });
  it("allows four implemented styles while preserving content and per-style settings", () => {
    let current = structuredClone(initialSite);
    current.appearances.gallery.spacing = 120;
    const content = structuredClone(current.pages);
    for (const id of [...styleIds, ...styleIds].reverse()) {
      current = siteSchema.parse({ ...current, styleId: id });
      expect(current.pages).toEqual(content);
      expect(current.appearances.gallery.spacing).toBe(120);
    }
    expect(
      siteSchema.safeParse({ ...current, styleId: "not-a-style" }).success,
    ).toBe(false);
  });
});
describe("editor history ownership", () => {
  it("coalesces a typing burst into one undo without swallowing a later field or structural edit", () => {
    let h = createHistory(initialSite);
    h = editHistory(h, { ...h.present, name: "M" }, "identity:name", 100);
    h = editHistory(h, { ...h.present, name: "Ma" }, "identity:name", 200);
    h = editHistory(h, { ...h.present, name: "Mara A" }, "identity:name", 300);
    expect(h.past).toHaveLength(1);
    h = editHistory(
      h,
      { ...h.present, tagline: "A practice" },
      "identity:tagline",
      400,
    );
    h = editHistory(h, { ...h.present, styleId: "cinema" });
    h = undoHistory(h);
    expect(h.present.styleId).toBe("folio");
    expect(h.present.tagline).toBe("A practice");
    h = undoHistory(h);
    expect(h.present.name).toBe("Mara A");
    h = undoHistory(h);
    expect(h.present).toEqual(initialSite);
    expect(redoHistory(h).present.name).toBe("Mara A");
  });
  it("handles repeated immediate undo/redo without a stale-render closure", () => {
    let h = createHistory(initialSite);
    for (const name of ["One", "Two", "Three"])
      h = editHistory(h, { ...h.present, name });
    h = undoHistory(undoHistory(h));
    expect(h.present.name).toBe("One");
    h = redoHistory(redoHistory(h));
    expect(h.present.name).toBe("Three");
  });
  it("does not record no-op moves and drops redo only for a real new edit", () => {
    let h = createHistory(initialSite);
    expect(editHistory(h, structuredClone(initialSite))).toBe(h);
    h = editHistory(h, { ...h.present, name: "Changed" });
    h = undoHistory(h);
    h = editHistory(h, { ...h.present, name: "Another" });
    expect(h.future).toHaveLength(0);
  });
});
describe("serial saves under interruption", () => {
  it("writes the newest pending edit after a slow transaction, using the committed revision", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const writes: Array<[string, number]> = [];
    const queue = new SaveQueue(
      4,
      async (site, revision) => {
        writes.push([site.name, revision]);
        if (writes.length === 1) await gate;
        return revision + 1;
      },
      () => {},
      () => {},
    );
    queue.enqueue({ ...initialSite, name: "First" });
    queue.enqueue({ ...initialSite, name: "Second" });
    queue.enqueue({ ...initialSite, name: "Latest" });
    release();
    await queue.idle();
    expect(writes).toEqual([
      ["First", 4],
      ["Latest", 5],
    ]);
    expect(queue.revision).toBe(6);
    expect(queue.dirty).toBe(false);
  });
  it("keeps the latest pending edit when an older transaction fails", async () => {
    let reject!: (e: Error) => void;
    const gate = new Promise<number>((_, r) => (reject = r));
    const queue = new SaveQueue(
      0,
      () => gate,
      () => {},
      () => {},
    );
    queue.enqueue({ ...initialSite, name: "Older" });
    queue.enqueue({ ...initialSite, name: "Latest unsaved" });
    reject(new Error("Quota exceeded"));
    await queue.idle();
    expect(queue.pending!.name).toBe("Latest unsaved");
    expect(queue.error!.message).toBe("Quota exceeded");
    expect(queue.revision).toBe(0);
  });
});
describe("restore recovery", () => {
  it("retains the previous document when restoring a different draft", async () => {
    await saveDocument(initialSite, 0);
    const replacement = { ...initialSite, name: "Restored" };
    await importBackup(
      JSON.stringify({
        format: "latent-studio-backup",
        version: 2,
        site: replacement,
        assets: {},
      }),
      1,
    );
    const db = await database();
    expect((await db.get("documents", "before-restore"))!.value).toEqual(
      initialSite,
    );
    expect((await loadDocument()).value.name).toBe("Restored");
  });
  it("keeps prior media when an imported ID collides with a different saved blob", async () => {
    const db = await database();
    await db.put(
      "assets",
      new Blob(["old bytes"], { type: "image/jpeg" }),
      "same-id",
    );
    const original = structuredClone(initialSite);
    original.pages[1].blocks[0].assetId = "same-id";
    await saveDocument(original, 0);
    const result = await importBackup(
      JSON.stringify({
        format: "latent-studio-backup",
        version: 2,
        site: original,
        assets: { "same-id": "data:image/jpeg;base64,bmV3IGJ5dGVz" },
      }),
      1,
    );
    expect(await (await readAsset("same-id"))!.text()).toBe("old bytes");
    expect(
      await (await readAsset(result.value.pages[1].blocks[0].assetId))!.text(),
    ).toBe("new bytes");
  });
});
