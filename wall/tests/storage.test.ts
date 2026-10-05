import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import {
  database,
  loadDocument,
  saveDocument,
  storeAsset,
  readAsset,
  importBackup,
} from "../src/storage";
import { initialSite, moveItem, siteSchema } from "../src/model";
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
describe("durable content ownership", () => {
  it("persists successive edits and reloads the latest complete document", async () => {
    let revision = 0;
    for (const name of ["A", "An artist", "An artist revisited"])
      revision = await saveDocument({ ...initialSite, name }, revision);
    expect((await loadDocument()).value.name).toBe("An artist revisited");
    expect(revision).toBe(3);
  });
  it("rejects a stale second editor without overwriting the first", async () => {
    await saveDocument({ ...initialSite, name: "First editor" }, 0);
    await expect(
      saveDocument({ ...initialSite, name: "Stale editor" }, 0),
    ).rejects.toThrow("another window");
    expect((await loadDocument()).value.name).toBe("First editor");
  });
  it("keeps a media blob addressable across document reloads", async () => {
    const id = await storeAsset(
      new Blob(["photo bytes"], { type: "image/jpeg" }),
    );
    const site = structuredClone(initialSite);
    site.pages[1].blocks[0].assetId = id;
    await saveDocument(site, 0);
    expect((await loadDocument()).value.pages[1].blocks[0].assetId).toBe(id);
    expect(await (await readAsset(id))!.text()).toBe("photo bytes");
  });
  it("rejects unsupported and oversized media before storage", async () => {
    await expect(
      storeAsset(new Blob(["html"], { type: "text/html" })),
    ).rejects.toThrow("Choose");
    await expect(
      storeAsset(
        new Blob([new Uint8Array(30 * 1024 * 1024 + 1)], { type: "video/mp4" }),
      ),
    ).rejects.toThrow("30 MB");
  });
  it("restores content and media together from a valid portable backup", async () => {
    const site = structuredClone(initialSite);
    site.pages[1].blocks[0].assetId = "restored-asset";
    const data = {
      format: "latent-studio-backup",
      version: 1,
      site,
      assets: { "restored-asset": "data:image/jpeg;base64,aW1hZ2U=" },
    };
    const result = await importBackup(JSON.stringify(data), 0);
    expect(result.revision).toBe(1);
    expect((await readAsset("restored-asset"))!.type).toBe("image/jpeg");
    expect((await loadDocument()).value).toEqual(site);
  });
  it("leaves the draft and media untouched when backup validation fails", async () => {
    await saveDocument(initialSite, 0);
    const site = structuredClone(initialSite);
    site.name = "Must not be applied";
    site.pages[1].blocks[0].assetId = "missing";
    await expect(
      importBackup(
        JSON.stringify({
          format: "latent-studio-backup",
          version: 1,
          site,
          assets: {},
        }),
        1,
      ),
    ).rejects.toThrow("missing");
    expect((await loadDocument()).value.name).toBe(initialSite.name);
    expect(await readAsset("missing")).toBeUndefined();
  });
  it("preserves recoverable state when stored content is invalid", async () => {
    const db = await database();
    await db.put(
      "documents",
      { value: { ...initialSite, version: 99 } as never, revision: 1 },
      "site",
    );
    await expect(loadDocument()).rejects.toThrow();
    expect((await db.get("documents", "site"))!.value.version).toBe(99);
  });
});
describe("sequence and navigation contracts", () => {
  it("moves a block by identity while preserving the rest and supports inversion", () => {
    const blocks = initialSite.pages[1].blocks;
    const result = moveItem(blocks, 0, 2);
    expect(result.map((b) => b.id)).toEqual([
      "quiet-2",
      "quiet-3",
      "quiet-1",
      "quiet-4",
    ]);
    expect(moveItem(result, 2, 0)).toEqual(blocks);
    expect(moveItem(blocks, 0, -1)).toEqual(blocks);
  });
  it("rejects duplicate identities and missing home pages in imported documents", () => {
    const duplicate = structuredClone(initialSite);
    duplicate.pages[1].id = "home";
    expect(siteSchema.safeParse(duplicate).success).toBe(false);
    const missing = structuredClone(initialSite);
    missing.pages = missing.pages.slice(1);
    expect(siteSchema.safeParse(missing).success).toBe(false);
  });
  it("does not permit unimplemented styles or unsafe contact links", () => {
    expect(
      siteSchema.safeParse({ ...initialSite, styleId: "not-a-style" }).success,
    ).toBe(false);
    expect(
      siteSchema.safeParse({ ...initialSite, email: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
});
