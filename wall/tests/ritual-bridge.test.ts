import "fake-indexeddb/auto";
import { portableHTML, portablePackage } from "../src/portable";
import type { Revision } from "../src/revisions";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { afterEach, vi, beforeEach, describe, expect, it } from "vitest";
import { openDB } from "idb";
import {
  crc32,
  decodePublication,
  parseUnambiguousJSON,
  readPublicationZIP,
  sha256,
} from "../src/ritualArchive";
import {
  composeStory,
  createStoryDraft,
  listStoryDrafts,
} from "../src/ritualImport";
import { databaseName } from "../src/workspace";
import {
  database,
  loadDocument,
  saveDocument,
  exportBackup,
  importBackup,
} from "../src/storage";
import { siteSchema } from "../src/model";
const bytes = new Uint8Array(
  readFileSync(
    new URL("./fixtures/ritual-story-publication.zip", import.meta.url),
  ),
);
const blob = () => new Blob([bytes], { type: "application/zip" });
const probe = async (b: Blob, w: number, h: number) => {
  expect(b.type).toBe("image/png");
  expect(w).toBeGreaterThan(0);
  expect(h).toBeGreaterThan(0);
};
const admit = () => decodePublication(blob(), probe);
// Malformed packages are derived from the real Swift artifact, with independent ZIP assembly for attack cases.
function zip(entries: [string, Uint8Array][]): Blob {
  const chunks: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const n = new TextEncoder().encode(name),
      local = new Uint8Array(30 + n.length + data.length),
      v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint32(14, crc32(data), true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, n.length, true);
    local.set(n, 30);
    local.set(data, 30 + n.length);
    chunks.push(local);
    const c = new Uint8Array(46 + n.length),
      d = new DataView(c.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint32(16, crc32(data), true);
    d.setUint32(20, data.length, true);
    d.setUint32(24, data.length, true);
    d.setUint16(28, n.length, true);
    d.setUint32(42, offset, true);
    c.set(n, 46);
    central.push(c);
    offset += local.length;
  }
  const end = new Uint8Array(22),
    d = new DataView(end.buffer);
  d.setUint32(0, 0x06054b50, true);
  d.setUint16(8, entries.length, true);
  d.setUint16(10, entries.length, true);
  d.setUint32(
    12,
    central.reduce((n, a) => n + a.length, 0),
    true,
  );
  d.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end] as BlobPart[]);
}
const entries = () => [...readPublicationZIP(bytes)];
function changed(fn: (m: Record<string, unknown>) => void) {
  const files = entries(),
    m = JSON.parse(new TextDecoder().decode(files[0][1]));
  fn(m);
  files[0][1] = new TextEncoder().encode(JSON.stringify(m));
  return zip(files);
}
beforeEach(async () => {
  vi.stubGlobal(
    "FileReader",
    class {
      result = "";
      onload = () => {};
      onerror = () => {};
      readAsDataURL(blob: Blob) {
        void blob
          .arrayBuffer()
          .then((data) => {
            this.result = `data:${blob.type};base64,${Buffer.from(data).toString("base64")}`;
            this.onload();
          })
          .catch(() => this.onerror());
      }
    },
  );
  const db = await database();
  await db.clear("documents");
  await db.clear("assets");
});
afterEach(() => vi.unstubAllGlobals());
describe("actual Ritual exporter → website importer", () => {
  it("admits the actual Swift exporter ZIP and retains the exact public manuscript", async () => {
    const a = await admit();
    expect(a.manifest.story.title).toBe("The space between");
    expect(a.manifest.story.frames.map((f) => f.caption.source)).toEqual([
      "inherit",
      "silence",
      "authored",
      "authored",
    ]);
    expect(Object.keys(a.assets)).toHaveLength(4);
    expect(a.packageSha256).toBe(await sha256(bytes));
    expect(JSON.stringify(a.manifest)).not.toMatch(
      /PRIVATE|SECRET|imageId|seedCaption|sourceURL|intent|\/Users\//,
    );
  });
  it("maps cover, adjacent pair, breath, full bleed and mobile reading order without recropping", async () => {
    const a = await admit(),
      s = composeStory(a, "Fixture artist"),
      p = s.pages[1];
    expect(p.blocks).toHaveLength(5);
    expect(p.blocks.map((b) => b.caption)).toEqual([
      "",
      ...a.manifest.story.frames.map((f) => f.caption.text),
    ]);
    expect(p.blocks.every((b) => b.fit === "original")).toBe(true);
    expect(p.blocks[0].assetId).toBe(a.manifest.story.coverAssetId);
    expect(p.composition!.desktop.map((s) => s.blockIds.length)).toEqual([
      1, 2, 1, 1,
    ]);
    expect(p.composition!.desktop[2].width).toBe("reading");
    expect(p.composition!.desktop[3].width).toBe("full");
    expect(p.composition!.mobile.every((s) => s.layout === "stack")).toBe(true);
  });
  it("requires approval and creates a different database without changing the prior draft or media", async () => {
    const old = await loadDocument(),
      db = await database();
    await db.put("assets", new Blob(["keep"]), "private-existing");
    const a = await admit(),
      s = composeStory(a, "Fixture artist");
    await expect(createStoryDraft(s, a.assets, false)).rejects.toThrow(
      "confirm",
    );
    const result = await createStoryDraft(s, a.assets, true),
      saved = await openDB(databaseName(result.id));
    expect((await saved.get("documents", "site")).value).toEqual(s);
    expect(await saved.count("assets")).toBe(4);
    expect(await loadDocument()).toEqual(old);
    expect(await db.count("assets")).toBe(1);
    expect((await listStoryDrafts()).some((d) => d.id === result.id)).toBe(
      true,
    );
    saved.close();
  });
  it("cleans up an interrupted media transaction without a partial draft or library entry", async () => {
    const a = await admit(),
      s = composeStory(a, "Failing fixture"),
      before = (await indexedDB.databases()).map((d) => d.name).sort(),
      library = await listStoryDrafts();
    const bad = {
      ...a.assets,
      [Object.keys(a.assets)[1]]: (() => {}) as unknown as Blob,
    };
    await expect(createStoryDraft(s, bad, true)).rejects.toThrow();
    expect(
      (await indexedDB.databases())
        .map((d) => d.name)
        .filter((n) => n !== "latent-studio-story-library-v1")
        .sort(),
    ).toEqual(before.filter((n) => n !== "latent-studio-story-library-v1"));
    expect(await listStoryDrafts()).toEqual(library);
  });
  it("preserves the v6 draft exactly before first migration save", async () => {
    const current = await loadDocument(),
      { sourcePublication: _, ...v7 } = current.value;
    void _;
    const v6 = { ...v7, version: 6 };
    const db = await database();
    await db.put("documents", { value: v6, revision: 8 }, "site");
    const loaded = await loadDocument();
    expect(loaded.value.version).toBe(13);
    expect((await db.get("documents", "site"))!.value).toEqual(v6);
    await saveDocument(loaded.value, 8);
    expect(await db.get("documents", "pre-story-bridge")).toEqual({
      value: v6,
      revision: 8,
    });
  });
  it("keeps immutable publication provenance through editing and a backup restore", async () => {
    const a = await admit(),
      s = composeStory(a, "Fixture artist"),
      receipt = structuredClone(s.sourcePublication);
    s.pages[1].title = "Later web title";
    const parsed = siteSchema.parse(s);
    expect(parsed.sourcePublication).toEqual(receipt);
    const text = await exportBackup(parsed, a.assets);
    expect(JSON.parse(text).version).toBe(13);
    const current = await loadDocument(),
      restored = await importBackup(text, current.revision);
    expect(restored.value.sourcePublication).toEqual(receipt);
    expect(restored.value.pages[1].title).toBe("Later web title");
  });
});
it("carries the native Story through actual standalone HTML and website ZIP exporters", async () => {
  const a = await admit(),
    site = composeStory(a, "Ritual bridge study");
  const revision: Revision = {
    format: "latent-studio-revision",
    version: 1,
    id: crypto.randomUUID(),
    name: "Synthetic native Story",
    createdAt: "2026-10-05T00:00:00.000Z",
    sourceRevision: 1,
    site,
    assets: a.assets,
    manifest: Object.entries(a.assets).map(([id, b]) => ({
      id,
      type: b.type,
      bytes: b.size,
      missing: false,
    })),
  };
  const html = await portableHTML(revision),
    folder = await portablePackage(revision, "original");
  const embedded = JSON.parse(
    html.match(
      /<script id="latent-document" type="application\/json">([\s\S]*?)<\/script>/,
    )![1],
  );
  expect(embedded.site.sourcePublication).toEqual(site.sourcePublication);
  expect(
    Object.values(embedded.assets).every((v) =>
      String(v).startsWith("data:image/png;base64,"),
    ),
  ).toBe(true);
  expect(html).not.toContain("PRIVATE_");
  const stylesheet = html.match(/<style>([\s\S]*?)<\/style>/)![1];
  expect(stylesheet).toContain(".composition-section");
  expect(stylesheet).toContain("@media");
  expect(stylesheet.length).toBeGreaterThan(1000);
  expect(folder.receipt.files).toBe(4);
  if (process.env.RITUAL_BRIDGE_EVIDENCE) {
    const root = "docs/evidence/ritual-bridge";
    mkdirSync(root, { recursive: true });
    writeFileSync(`${root}/native-story.html`, html);
    writeFileSync(
      `${root}/native-story-website.zip`,
      Buffer.from(await folder.blob.arrayBuffer()),
    );
    writeFileSync(
      `${root}/interop-report.json`,
      JSON.stringify(
        {
          source:
            "Compiled Ritual Mac DEBUG diagnostic using LatentSequence → actual adapter → actual publication writer",
          packageSha256: a.packageSha256,
          producer: a.manifest.producer,
          title: a.manifest.story.title,
          captionSources: a.manifest.story.frames.map((f) => f.caption.source),
          roles: a.manifest.story.frames.map((f) => f.role),
          cover: a.manifest.story.coverAssetId,
          documentVersion: site.version,
          blocks: site.pages[1].blocks.map((b) => ({
            assetId: b.assetId,
            caption: b.caption,
            fit: b.fit,
          })),
          sections: site.pages[1].composition,
          mediaCount: Object.keys(a.assets).length,
          receiptPreservedInHTML: true,
          websiteZipMediaFiles: folder.receipt.files,
          browserImageDecode:
            "This Node test injects an image probe. The separate ui/report.json records actual browser decode and rendering checks.",
          uiVerification:
            "See ui/report.json and screenshots for separate supported-browser observations.",
        },
        null,
        2,
      ),
    );
  }
});
describe("publication admission fails closed", () => {
  it("rejects media above the restorable draft and release ceiling", async () => {
    await expect(
      decodePublication(
        changed((m) =>
          (m.assets as { bytes: number }[]).forEach(
            (a) => (a.bytes = 20 * 1024 * 1024),
          ),
        ),
        probe,
      ),
    ).rejects.toThrow("60 MB");
  });
  it("rejects metadata even when ZIP and SHA-256 are internally consistent", async () => {
    const files = entries(),
      m = JSON.parse(new TextDecoder().decode(files[0][1]));
    const original = files[1][1],
      payload = new TextEncoder().encode("Location\0PRIVATE_METADATA"),
      chunk = new Uint8Array(payload.length + 12),
      view = new DataView(chunk.buffer);
    view.setUint32(0, payload.length);
    chunk.set(new TextEncoder().encode("tEXt"), 4);
    chunk.set(payload, 8);
    view.setUint32(
      chunk.length - 4,
      crc32(chunk.subarray(4, chunk.length - 4)),
    );
    const png = new Uint8Array(original.length + chunk.length);
    png.set(original.subarray(0, 33));
    png.set(chunk, 33);
    png.set(original.subarray(33), 33 + chunk.length);
    files[1][1] = png;
    m.assets[0].bytes = png.length;
    m.assets[0].sha256 = await sha256(png);
    files[0][1] = new TextEncoder().encode(JSON.stringify(m));
    await expect(decodePublication(zip(files), probe)).rejects.toThrow(
      "metadata",
    );
  });

  it("rejects unsupported versions and private/unknown manifest fields", async () => {
    await expect(
      decodePublication(
        changed((m) => (m.version = 2)),
        probe,
      ),
    ).rejects.toThrow("manifest");
    await expect(
      decodePublication(
        changed((m) => (m.intent = "private note")),
        probe,
      ),
    ).rejects.toThrow("public fields");
  });
  it("rejects duplicate JSON keys even when escaped", () => {
    expect(() =>
      parseUnambiguousJSON('{"version":1,"vers\\u0069on":2}'),
    ).toThrow("duplicate");
    expect(parseUnambiguousJSON('{"a":{"v":1},"b":{"v":2}}')).toEqual({
      a: { v: 1 },
      b: { v: 2 },
    });
  });
  it("rejects missing, extra and duplicate media entries", async () => {
    const f = entries();
    await expect(decodePublication(zip(f.slice(0, -1)), probe)).rejects.toThrow(
      "Missing",
    );
    await expect(decodePublication(zip([...f, f[1]]), probe)).rejects.toThrow(
      "duplicated",
    );
    await expect(
      decodePublication(
        zip([
          ...f,
          ["media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png", f[1][1]],
        ]),
        probe,
      ),
    ).rejects.toThrow("unlisted");
  });
  it.each([
    "../story.json",
    "/story.json",
    "media/../story.json",
    "media\\x.png",
    "%2e%2e/story.json",
  ])("rejects unsafe path %s", async (path) => {
    const f = entries();
    f[1][0] = path;
    await expect(decodePublication(zip(f), probe)).rejects.toThrow("Unsafe");
  });
  it("rejects compressed, linked, truncated and corrupted ZIP content", async () => {
    const compressed = bytes.slice();
    new DataView(compressed.buffer).setUint16(8, 8, true);
    await expect(
      decodePublication(new Blob([compressed]), probe),
    ).rejects.toThrow("headers");
    const linked = bytes.slice(),
      v = new DataView(linked.buffer),
      c = v.getUint32(linked.length - 6, true);
    v.setUint32(c + 38, 0xa1ff0000, true);
    await expect(decodePublication(new Blob([linked]), probe)).rejects.toThrow(
      "linked",
    );
    await expect(
      decodePublication(new Blob([bytes.slice(0, -10)]), probe),
    ).rejects.toThrow();
    const broken = bytes.slice();
    broken[100] ^= 1;
    await expect(decodePublication(new Blob([broken]), probe)).rejects.toThrow(
      "CRC",
    );
  });
  it("rejects excess size before reading and a malformed image after a matching manifest", async () => {
    await expect(
      decodePublication(
        {
          size: 81 * 1024 * 1024,
          arrayBuffer: () => {
            throw new Error("must not read");
          },
        } as unknown as Blob,
        probe,
      ),
    ).rejects.toThrow("80 MB");
    const f = entries(),
      m = JSON.parse(new TextDecoder().decode(f[0][1]));
    f[1][1] = new Uint8Array([1, 2, 3]);
    m.assets[0].bytes = 3;
    m.assets[0].sha256 = await sha256(f[1][1]);
    f[0][1] = new TextEncoder().encode(JSON.stringify(m));
    await expect(decodePublication(zip(f), probe)).rejects.toThrow("not a PNG");
  });
  it("rejects decode failures before any draft write", async () => {
    const before = await loadDocument();
    await expect(
      decodePublication(blob(), async () => {
        throw new Error("bad pixels");
      }),
    ).rejects.toThrow("decoded");
    expect(await loadDocument()).toEqual(before);
  });
  it("rejects impossible dimensions and unknown roles", async () => {
    await expect(
      decodePublication(
        changed((m) => ((m.assets as { width: number }[])[0].width = 99999)),
        probe,
      ),
    ).rejects.toThrow("manifest");
    await expect(
      decodePublication(
        changed(
          (m) =>
            ((m.story as { frames: { role: string }[] }).frames[0].role =
              "future"),
        ),
        probe,
      ),
    ).rejects.toThrow("manifest");
  });
});
