import { legacySite } from "./viewportFixtures";
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  database,
  loadDocument,
  saveDocument,
  storeAsset,
  readAsset,
  importBackup,
} from "../src/storage";
import { initialSite, siteSchema, styleIds } from "../src/model";
import { localRevisions, collectMedia, type Revision } from "../src/revisions";
import { contentPreflight, compareSites } from "../src/publication";
import { preflight } from "../src/preflight";
import { safeJSON, escapeHTML, portableHTML } from "../src/portable";
import { createSample } from "../src/samples";
vi.mock("../src/mediaValidation", () => ({
  validateMedia: vi.fn(async () => {}),
}));
const photo = () => new Blob(["immutable-original"], { type: "image/jpeg" });
const siteWithoutMedia = () => ({
  ...structuredClone(initialSite),
  pages: initialSite.pages.map((p) => ({
    ...p,
    blocks: p.blocks.filter((b) => b.type === "text"),
  })),
});
beforeEach(async () => {
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(photo(), { status: 200 })),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function seed() {
  const value = siteWithoutMedia();
  await saveDocument(value, 0);
  return value;
}
describe("immutable release and recovery", () => {
  it("migrates v4 without changing composition and retains the exact input on first save", async () => {
    const { publication, ...rest } = legacySite(createSample("sora"));
    void publication;
    const old = { ...rest, version: 4 };
    const db = await database();
    await db.put("documents", { value: old, revision: 7 }, "site");
    const loaded = await loadDocument();
    expect(loaded.value.version).toBe(13);
    expect(loaded.value.pages.map((p) => p.blocks)).toEqual(
      old.pages.map((p) => p.blocks),
    );
    await saveDocument(
      {
        ...loaded.value,
        publication: { ...loaded.value.publication, title: "Edition" },
      },
      7,
    );
    expect(
      (await db.get("documents", "pre-publication-system"))?.value,
    ).toEqual(old);
    expect(
      (await localRevisions.list()).revisions.some(
        (r) => r.id === "pre-publication-system",
      ),
    ).toBe(true);
  });
  it("freezes words, metadata, composition and media across later draft edits", async () => {
    const site = await seed();
    const id = await storeAsset(photo());
    site.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: id,
    });
    await saveDocument(site, 1);
    const r = await localRevisions.checkpoint(site, 2, "First", {
      expectedId: null,
    });
    await saveDocument(
      {
        ...site,
        name: "Later draft",
        publication: { ...site.publication, title: "Later metadata" },
      },
      2,
    );
    const frozen = await localRevisions.read("revision:" + r.id);
    expect(frozen.site.name).toBe(site.name);
    expect(frozen.site.publication.title).toBe(site.publication.title);
    expect(await frozen.assets[id].text()).toBe("immutable-original");
    expect((await localRevisions.list()).releaseId).toBe("revision:" + r.id);
    frozen.site.name = "Mutating a reader copy";
    expect((await localRevisions.read("revision:" + r.id)).site.name).toBe(
      site.name,
    );
  });
  it("keeps frozen media even if the draft asset store is unavailable", async () => {
    const site = await seed();
    const id = await storeAsset(photo());
    site.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: id,
    });
    await saveDocument(site, 1);
    const r = await localRevisions.checkpoint(site, 2, "Photographs");
    await (await database()).clear("assets");
    expect(
      await (await localRevisions.read("revision:" + r.id)).assets[id].text(),
    ).toBe("immutable-original");
    const restored = await localRevisions.restore("revision:" + r.id, 2);
    const newId = restored.value.pages[1].blocks.at(-1)!.assetId;
    expect(newId).not.toBe(id);
    expect(await (await readAsset(newId))?.text()).toBe("immutable-original");
  });
  it("preserves the replaced draft and keeps the release fixed when restoring", async () => {
    const site = await seed();
    const r = await localRevisions.checkpoint(site, 1, "Opening", {
      expectedId: null,
    });
    await saveDocument({ ...site, name: "Work after release" }, 1);
    const restored = await localRevisions.restore("revision:" + r.id, 2);
    expect(restored.revision).toBe(3);
    expect(restored.value.name).toBe(site.name);
    const library = await localRevisions.list();
    expect(library.releaseId).toBe("revision:" + r.id);
    const before = library.revisions.find(
      (r) => r.name === "Before restoring Opening",
    )!;
    expect((await localRevisions.read(before.id)).site.name).toBe(
      "Work after release",
    );
    const recovered = await localRevisions.restore(before.id, 3);
    expect(recovered.value.name).toBe("Work after release");
    expect((await localRevisions.list()).revisions).toHaveLength(3);
  });
  it("rejects stale draft and release pointers atomically", async () => {
    const site = await seed();
    const r = await localRevisions.checkpoint(site, 1, "One", {
      expectedId: null,
    });
    await expect(
      localRevisions.checkpoint(site, 1, "Stale release", { expectedId: null }),
    ).rejects.toThrow("another window");
    await saveDocument({ ...site, name: "Next" }, 1);
    await expect(localRevisions.restore("revision:" + r.id, 1)).rejects.toThrow(
      "another window",
    );
    await expect(
      localRevisions.checkpoint(site, 1, "Stale draft"),
    ).rejects.toThrow("another window");
    expect((await localRevisions.list()).revisions).toHaveLength(1);
  });
  it("leaves document, media, history and release intact on transaction failure during restore", async () => {
    const site = await seed();
    const r = await localRevisions.checkpoint(site, 1, "One", {
      expectedId: null,
    });
    await saveDocument({ ...site, name: "Current" }, 1);
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementationOnce(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    await expect(localRevisions.restore("revision:" + r.id, 2)).rejects.toThrow(
      "Storage full",
    );
    expect((await loadDocument()).value.name).toBe("Current");
    expect((await localRevisions.list()).revisions).toHaveLength(1);
  });
  it("rolls back a release pointer and snapshot together if storage fails", async () => {
    const site = await seed();
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (key === "local-release")
        throw new DOMException("Storage full", "QuotaExceededError");
      return put.call(this, value, key!);
    });
    await expect(
      localRevisions.checkpoint(site, 1, "Failure", { expectedId: null }),
    ).rejects.toThrow("Storage full");
    expect(await localRevisions.list()).toEqual({
      revisions: [],
      releaseId: null,
    });
    expect((await loadDocument()).revision).toBe(1);
  });
  it("keeps multiple backup imports recoverable and preserves v4 input", async () => {
    await seed();
    const { publication, ...rest } = legacySite(createSample("sora"));
    void publication;
    const text = JSON.stringify({
      format: "latent-studio-backup",
      version: 4,
      site: { ...rest, version: 4 },
      assets: {},
    });
    const a = await importBackup(text, 1);
    await importBackup(text, a.revision);
    expect(
      (await localRevisions.list()).revisions.filter((r) =>
        r.id.startsWith("recovery:"),
      ),
    ).toHaveLength(2);
    expect((await loadDocument()).value.pages).toEqual(
      siteSchema.parse({ ...rest, version: 4 }).pages,
    );
  });
  it("refuses missing media release while allowing a recovery checkpoint", async () => {
    const site = await seed();
    site.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: "missing",
    });
    await saveDocument(site, 1);
    await localRevisions.checkpoint(site, 2, "Needs repair");
    await expect(
      localRevisions.checkpoint(site, 2, "Invalid release", {
        expectedId: null,
      }),
    ).rejects.toThrow("Preflight");
    expect((await localRevisions.list()).releaseId).toBeNull();
  });
});
describe("media ownership across recovery", () => {
  it("restores bundled media from frozen bytes even when original URLs change", async () => {
    const site = structuredClone(initialSite);
    await saveDocument(site, 0);
    const r = await localRevisions.checkpoint(site, 1, "Frozen original demos");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("changed demo", { status: 200 })),
    );
    const restored = await localRevisions.restore("revision:" + r.id, 1);
    const id = restored.value.pages[1].blocks[0].assetId;
    expect(id).toMatch(/^demo-frozen:sea:/);
    expect(await (await readAsset(id))?.text()).toBe("immutable-original");
  });
  it("accepts only exact bundled vectors when restoring an embedded vector original", async () => {
    const site = siteWithoutMedia();
    const svg = readFileSync(
      new URL("../public/media/form-blue.svg", import.meta.url),
    );
    site.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: "frozen-vector",
    });
    const backup = {
      format: "latent-studio-backup",
      version: 5,
      site,
      assets: {
        "frozen-vector": "data:image/svg+xml;base64," + svg.toString("base64"),
      },
    };
    await importBackup(JSON.stringify(backup), 0);
    expect((await readAsset("frozen-vector"))?.type).toBe("image/svg+xml");
    backup.assets["frozen-vector"] =
      "data:image/svg+xml;base64," +
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
      ).toString("base64");
    await expect(importBackup(JSON.stringify(backup), 1)).rejects.toThrow(
      "bundled demo vector",
    );
    expect((await loadDocument()).revision).toBe(1);
  });
  it("stops a cancelled review without producing a readiness result", async () => {
    const site = siteWithoutMedia();
    const abort = new AbortController();
    abort.abort();
    const r = {
      format: "latent-studio-revision",
      version: 1,
      id: "cancel",
      name: "cancel",
      createdAt: "",
      sourceRevision: 1,
      site,
      assets: {},
      manifest: [{ id: "missing", type: "", bytes: 0, missing: true }],
    } as Revision;
    await expect(preflight(r, undefined, abort.signal)).rejects.toThrow();
  });
  it("rolls back imported media and recovery records on a document write failure", async () => {
    await seed();
    const site = siteWithoutMedia();
    site.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: "new-asset",
    });
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (key === "site")
        throw new DOMException("Disk full", "QuotaExceededError");
      return put.call(this, value, key!);
    });
    await expect(
      importBackup(
        JSON.stringify({
          format: "latent-studio-backup",
          version: 5,
          site,
          assets: { "new-asset": "data:image/jpeg;base64,aW1hZ2U=" },
        }),
        1,
      ),
    ).rejects.toThrow("Disk full");
    expect(await readAsset("new-asset")).toBeUndefined();
    expect((await localRevisions.list()).revisions).toHaveLength(0);
    expect((await loadDocument()).revision).toBe(1);
  });
});
describe("publication input and portable output", () => {
  it("reports invalid metadata without rewriting authored content", () => {
    const site = siteWithoutMedia();
    site.publication = {
      title: "",
      description: "",
      language: "not_a_language",
      canonical: "javascript:alert(1)",
    };
    const before = structuredClone(site);
    expect(
      contentPreflight(site).filter((i) => i.severity === "error"),
    ).toHaveLength(3);
    expect(site).toEqual(before);
  });
  it("accepts a legitimate language tag and HTTPS canonical, warns on empty destinations and contrast", () => {
    const site = siteWithoutMedia();
    site.publication.language = "ar";
    site.publication.canonical = "https://artist.example/";
    site.pages[1].subtitle = "";
    site.pages[1].blocks = [];
    site.appearances.folio.identity.ink = "#eeeeee";
    expect(
      contentPreflight(site).some((i) => i.message.includes("no content")),
    ).toBe(true);
    expect(
      contentPreflight(site).some((i) => i.message.includes("contrast")),
    ).toBe(true);
    expect(contentPreflight(site).some((i) => i.severity === "error")).toBe(
      false,
    );
  });
  it("rejects unsupported MIME backup and missing bytes before any write", async () => {
    await seed();
    const site = structuredClone(initialSite);
    site.pages[1].blocks[0].assetId = "hostile";
    for (const data of [
      "data:text/html;base64,PHNjcmlwdD4=",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,!",
    ]) {
      await expect(
        importBackup(
          JSON.stringify({
            format: "latent-studio-backup",
            version: 5,
            site,
            assets: { hostile: data },
          }),
          1,
        ),
      ).rejects.toThrow();
    }
    expect((await loadDocument()).revision).toBe(1);
  });
  it("records missing and undecodable media in preflight", async () => {
    const site = structuredClone(initialSite);
    site.pages[1].blocks[0].assetId = "missing";
    const media = await collectMedia(site);
    const r = {
      format: "latent-studio-revision",
      version: 1,
      id: "x",
      name: "x",
      createdAt: "",
      sourceRevision: 1,
      site,
      ...media,
    } as Revision;
    const issues = await preflight(r, async () => {
      throw new Error("bad bytes");
    });
    expect(issues.some((i) => i.message.includes("missing"))).toBe(true);
    expect(issues.some((i) => i.message.includes("could not decode"))).toBe(
      true,
    );
  });
  it("escapes hostile authored text at both JSON and HTML boundaries", () => {
    const attack = '</script><script>alert("x")</script>&\u2028';
    expect(safeJSON({ text: attack })).not.toContain("<");
    expect(JSON.parse(safeJSON({ text: attack })).text).toBe(attack);
    expect(escapeHTML(attack)).not.toContain("<script>");
  });
  it.each(styleIds)(
    "keeps %s in a self-contained export with routes and safe metadata",
    async (style) => {
      const site = siteWithoutMedia();
      site.styleId = style;
      site.publication.title = "A <title>";
      site.pages[0].title = "</script><script>bad()</script>";
      const r = await localRevisions.checkpoint(
        await (async () => {
          await saveDocument(site, 0);
          return site;
        })(),
        1,
        "Export",
      );
      const html = await portableHTML(r);
      expect(html).toContain("A &lt;title&gt;");
      expect(html).toContain("latent-studio-website");
      expect(html).not.toContain("<script>bad()");
      expect(html).not.toContain('src="/');
      const data = JSON.parse(
        html.match(
          /<script id="latent-document" type="application\/json">(.*?)<\/script>/s,
        )![1],
      );
      expect(siteSchema.parse(data.site)).toEqual(site);
      expect(data.routes).toHaveLength(site.pages.length);
    },
  );
  it("compares authorship without calling differences errors", () => {
    const a = createSample("sora"),
      b = structuredClone(a);
    b.pages[1].title = "An edited title";
    b.publication.title = "New metadata";
    expect(compareSites(a, b)).toHaveLength(2);
  });
});
