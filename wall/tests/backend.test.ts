import { fixturePage, fixtureSite, legacySite } from "./viewportFixtures";
import { beginCanvas, publicWebsite } from "../src/compositionStudies";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialSite, originalStyleIds, type Site } from "../src/model";
import { SqliteRepository } from "../backend/sqlite";
import { StudioService } from "../backend/service";
import { PrivateFiles } from "../backend/files";
import { ManifestPublisher } from "../backend/publisher";
import { MacRasterInspector, headerDimensions } from "../backend/media";
import { hash, documentInput } from "../backend/validation";
import type {
  DomainVerifier,
  Principal,
  Publisher,
  PublicationRequest,
} from "../backend/contracts";
const alice: Principal = { subject: "fixture:alice" },
  bob: Principal = { subject: "fixture:bob" },
  viewer: Principal = { subject: "fixture:viewer" };
function emptySite(): Site {
  const d = structuredClone(initialSite);
  d.pages = d.pages.map((p) => ({
    ...p,
    composition: null,
    blocks: p.blocks.filter((b) => b.type === "text"),
  }));
  return d;
}
let root: string,
  dbPath: string,
  repo: SqliteRepository,
  objects: PrivateFiles,
  artifacts: PrivateFiles,
  publisher: ManifestPublisher,
  service: StudioService,
  now: number,
  domainPass: boolean;
let tenantA: string, tenantB: string, siteA: string, siteB: string;
let otherRepo: SqliteRepository | undefined;
const repositories: SqliteRepository[] = [];
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "latent-backend-test-"));
  dbPath = join(root, "db.sqlite");
  now = Date.now();
  domainPass = true;
  repo = new SqliteRepository(dbPath, () => now);
  repositories.push(repo);
  objects = await PrivateFiles.create(join(root, "originals"));
  artifacts = await PrivateFiles.create(join(root, "artifacts"));
  publisher = new ManifestPublisher(artifacts);
  const verifier: DomainVerifier = {
    verify: async () => ({
      verified: domainPass,
      evidence: "simulated-test-proof",
      expiresAt: now + 60000,
    }),
  };
  service = new StudioService(
    repo,
    objects,
    new MacRasterInspector(),
    publisher,
    verifier,
  );
  tenantA = await repo.createTenant(alice, "Studio A");
  tenantB = await repo.createTenant(bob, "Studio B");
  siteA = (await repo.createSite(alice, tenantA, emptySite())).siteId;
  siteB = (await repo.createSite(bob, tenantB, emptySite())).siteId;
});
afterEach(async () => {
  otherRepo?.close();
  otherRepo = undefined;
  for (const r of repositories.splice(0)) r.close();
  await rm(root, { recursive: true, force: true });
});
async function image() {
  const bytes = await readFile("public/media/sea.jpg");
  return service.upload(
    alice,
    siteA,
    {
      filename: "sea.jpg",
      mime: "image/jpeg",
      bytes: bytes.length,
      hash: hash(bytes),
    },
    bytes,
  );
}
async function withImage() {
  const a = await image(),
    d = await repo.draft(alice, siteA);
  d.document.pages[1].blocks.push({
    ...initialSite.pages[1].blocks[0],
    assetId: a.id,
  });
  await repo.saveDraft(alice, siteA, d.version, d.document);
  return a;
}
async function request(): Promise<PublicationRequest> {
  const d = await service.addDomain(alice, siteA, "artist.example.test");
  await service.verifyDomain(alice, d.id);
  return {
    siteId: siteA,
    domainId: d.id,
    expectedDraftVersion: (await repo.draft(alice, siteA)).version,
    expectedGeneration: 0,
    approvedAssetIds: [],
    idempotencyKey: randomUUID(),
  };
}
function count(table: string) {
  const db = new DatabaseSync(dbPath);
  try {
    return (
      db.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }
    ).n;
  } finally {
    db.close();
  }
}
describe("SQLite schema and owner boundaries", () => {
  it("persists spatial frames, dormant phone mode and reading/layer order through reopen, release and restore", async () => {
    const document = fixtureSite(fixturePage());
    document.pages.forEach((p) =>
      p.blocks.forEach((b) => {
        b.type = "text";
        b.assetId = "";
      }),
    );
    document.pages[1].intentions = [
      { id: "keep-a-b", kind: "together", from: "a", to: "b", scope: "both" },
      {
        id: "b-follows-a",
        kind: "follows",
        from: "a",
        to: "b",
        scope: "desktop",
      },
    ];
    const c = document.pages[1].composition!;
    c.desktop[0].captions = [
      { blockId: "a", size: 16, backing: "paper", position: "above" },
    ];
    c.mobile[0].captions = [{ blockId: "a", size: 14, backing: "ink" }];
    c.desktop[0].spatial = {
      enabled: true,
      minHeight: 320,
      frames: [
        { blockId: "a", x: 5, y: 40, width: 55 },
        { blockId: "b", x: 38, y: 200, width: 50 },
      ],
      layers: ["b", "a"],
    };
    c.mobile[0].spatial = {
      enabled: false,
      minHeight: 280,
      frames: [{ blockId: "a", x: 10, y: 24, width: 80 }],
      layers: ["a"],
    };
    await repo.saveDraft(alice, siteA, 1, document);
    otherRepo = new SqliteRepository(dbPath);
    expect((await otherRepo.draft(alice, siteA)).document).toEqual(document);
    const receipt = await service.publish(alice, await request()),
      sql = new DatabaseSync(dbPath);
    const sealed = sql
      .prepare("SELECT document FROM releases WHERE id=?")
      .get(receipt.releaseId)!.document as string;
    expect(JSON.parse(sealed)).toEqual(document);
    expect(
      JSON.parse(
        Buffer.from(
          await service.readPublished("artist.example.test", "site.json"),
        ).toString(),
      ),
    ).toEqual(publicWebsite(document));
    const changed = structuredClone(document);
    changed.pages[1].composition!.desktop[0].spatial!.frames[0].y = 500;
    await repo.saveDraft(alice, siteA, 2, changed);
    await repo.restoreDraft(alice, siteA, 2, 3);
    expect((await repo.draft(alice, siteA)).document).toEqual(document);
    expect(
      sql
        .prepare("SELECT document FROM releases WHERE id=?")
        .get(receipt.releaseId)!.document,
    ).toBe(sealed);
    sql.close();
    const old = structuredClone(document);
    delete old.pages[1].intentions;
    old.pages[1].composition!.desktop.forEach((s) => {
      delete s.spatial;
      delete s.captions;
    });
    old.pages[1].composition!.mobile.forEach((s) => {
      delete s.spatial;
      delete s.captions;
    });
    expect(documentInput({ ...old, version: 10 })).toEqual(old);
  });
  it("retains named typography and precise device geometry through reopen, history restore and immutable local release", async () => {
    const document = fixtureSite(fixturePage());
    document.pages.forEach((p) =>
      p.blocks.forEach((b) => {
        b.assetId = "";
        b.type = "text";
      }),
    );
    document.textStyles = [
      {
        id: "verse",
        name: "Verse",
        role: "poem",
        base: { font: "serif", size: 29, flow: "poem" },
        mobile: { size: 19 },
      },
    ];
    document.pages[1].blocks[0].typography = {
      styleId: "verse",
      base: { measure: 38 },
      mobile: { leading: 1.9 },
    };
    const c = document.pages[1].composition!;
    c.desktop[0] = { ...c.desktop[0], widthPercent: 85.9, columnRatio: 56.1 };
    c.mobile[0] = { ...c.mobile[0], widthPercent: 98.9 };
    await repo.saveDraft(alice, siteA, 1, document);
    otherRepo = new SqliteRepository(dbPath);
    expect((await otherRepo.draft(alice, siteA)).document).toEqual(document);
    const receipt = await service.publish(alice, await request());
    const sql = new DatabaseSync(dbPath);
    const sealed = sql
      .prepare("SELECT document FROM releases WHERE id=?")
      .get(receipt.releaseId)!.document as string;
    expect(JSON.parse(sealed)).toEqual(publicWebsite(document));
    const edited = structuredClone(document);
    edited.textStyles[0].base.size = 42;
    edited.pages[1].composition!.desktop[0].columnRatio = 63.5;
    await repo.saveDraft(alice, siteA, 2, edited);
    await repo.restoreDraft(alice, siteA, 2, 3);
    expect((await repo.draft(alice, siteA)).document).toEqual(document);
    expect(
      sql
        .prepare("SELECT document FROM releases WHERE id=?")
        .get(receipt.releaseId)!.document,
    ).toBe(sealed);
    sql.close();
  });
  it("admits old four-direction documents and preserves new directions through a real database reopen", async () => {
    const current = emptySite();
    const { sourcePublication, textStyles, ...historical } = current;
    void textStyles;
    void sourcePublication;
    const old = {
      ...historical,
      version: 5,
      appearances: Object.fromEntries(
        originalStyleIds.map((id) => [id, current.appearances[id]]),
      ),
    };
    const admitted = documentInput(old);
    expect(admitted.version).toBe(13);
    expect(admitted.pages).toEqual(old.pages);
    expect(documentInput({ ...current, styleId: "montage" }).styleId).toBe(
      "montage",
    );
    await repo.saveDraft(alice, siteA, 1, { ...current, styleId: "montage" });
    otherRepo = new SqliteRepository(dbPath);
    expect((await otherRepo.draft(alice, siteA)).document.styleId).toBe(
      "montage",
    );
    expect(() =>
      documentInput({ ...old, privateIntent: "do not retain" }),
    ).toThrow("Unknown document field");
  });

  it("persists independent viewport groups through SQLite reopen and historical draft restore", async () => {
    const document = fixtureSite(fixturePage());
    document.pages.forEach((p) =>
      p.blocks.forEach((b) => {
        b.assetId = "";
        b.type = "text";
      }),
    );
    await repo.saveDraft(alice, siteA, 1, document);
    otherRepo = new SqliteRepository(dbPath);
    expect((await otherRepo.draft(alice, siteA)).document).toEqual(document);
    const edited = { ...document, name: "Changed" };
    await repo.saveDraft(alice, siteA, 2, edited);
    await repo.restoreDraft(alice, siteA, 2, 3);
    expect((await repo.draft(alice, siteA)).document).toEqual(document);
    const coupled = emptySite(),
      old = legacySite(coupled),
      raw = JSON.stringify(old),
      digest = hash(raw),
      db = new DatabaseSync(dbPath);
    const oldSite = randomUUID();
    db.prepare("INSERT INTO sites VALUES(?,?)").run(oldSite, tenantA);
    db.prepare("INSERT INTO drafts VALUES(?,?,?,?,?)").run(
      oldSite,
      tenantA,
      1,
      raw,
      digest,
    );
    db.prepare("INSERT INTO draft_history VALUES(?,?,?,?,?,?)").run(
      oldSite,
      tenantA,
      1,
      raw,
      digest,
      alice.subject,
    );
    db.close();
    await repo.saveDraft(alice, oldSite, 1, document);
    await repo.restoreDraft(alice, oldSite, 1, 2);
    expect((await repo.draft(alice, oldSite)).document.version).toBe(13);
    const check = new DatabaseSync(dbPath);
    expect(
      check
        .prepare(
          "SELECT document,hash FROM draft_history WHERE site_id=? AND version=1",
        )
        .get(oldSite),
    ).toEqual({ document: raw, hash: digest });
    check.close();
  });
  it("applies checksummed migrations once and reopens persisted state", async () => {
    expect(count("schema_migrations")).toBe(3);
    otherRepo = new SqliteRepository(dbPath);
    expect((await otherRepo.draft(alice, siteA)).version).toBe(1);
    expect(count("schema_migrations")).toBe(3);
  });
  it("isolates cross-tenant draft read, update, history restore, role grant and site creation", async () => {
    await expect(repo.draft(bob, siteA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      repo.saveDraft(bob, siteA, 1, emptySite()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(repo.restoreDraft(bob, siteA, 1, 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      repo.grant(bob, tenantA, bob.subject, "editor"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      repo.createSite(bob, tenantA, emptySite()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await repo.draft(alice, siteA)).version).toBe(1);
  });
  it("allows viewer reads and editor drafts, but reserves publication and domains to owners", async () => {
    await repo.grant(alice, tenantA, viewer.subject, "viewer");
    expect((await repo.draft(viewer, siteA)).version).toBe(1);
    await expect(
      repo.saveDraft(viewer, siteA, 1, emptySite()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await repo.grant(alice, tenantA, viewer.subject, "editor");
    await repo.saveDraft(viewer, siteA, 1, emptySite());
    await expect(
      service.addDomain(viewer, siteA, "x.example.test"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      repo.grant(alice, tenantA, alice.subject, "viewer"),
    ).rejects.toThrow("demote");
  });
  it("retains every draft, rejects stale writers and restores as a new revision", async () => {
    const d = emptySite();
    d.name = "Changed";
    await repo.saveDraft(alice, siteA, 1, d);
    await expect(
      repo.saveDraft(alice, siteA, 1, emptySite()),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const restored = await repo.restoreDraft(alice, siteA, 1, 2);
    expect(restored.version).toBe(3);
    expect(restored.document.name).toBe(initialSite.name);
    expect(count("draft_history")).toBe(4);
  });
  it("rejects malformed routes, private unknown metadata, remote media IDs and unsafe canonical URLs without a write", async () => {
    const cases = [];
    let d = emptySite();
    d.pages[0].id = "../outside";
    cases.push(d);
    d = emptySite();
    (d as unknown as Record<string, unknown>).privateIntent = "secret";
    cases.push(d);
    d = emptySite();
    d.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: "https://other/asset",
    });
    cases.push(d);
    d = emptySite();
    d.publication.canonical = "javascript:alert(1)";
    cases.push(d);
    for (const input of cases)
      await expect(
        repo.saveDraft(alice, siteA, 1, input),
      ).rejects.toMatchObject({ code: "INVALID" });
    expect((await repo.draft(alice, siteA)).version).toBe(1);
  });
});
describe("private uploads and immutable media", () => {
  it("decodes an actual JPEG, stores exact bytes and checks tenant/site ownership on reads and references", async () => {
    const a = await image();
    expect(a.width * a.height).toBe(2000 * 1333);
    expect(hash(await service.readOriginal(alice, siteA, a.id))).toBe(a.hash);
    await expect(service.readOriginal(bob, siteA, a.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.readOriginal(bob, siteB, a.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const draft = emptySite();
    draft.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: a.id,
    });
    await expect(repo.saveDraft(bob, siteB, 1, draft)).rejects.toMatchObject({
      code: "MEDIA",
    });
  });
  it("rejects traversal, hidden fields, MIME mismatch, SVG and incorrect hashes before staging", async () => {
    const bytes = await readFile("public/media/sea.jpg"),
      m = {
        filename: "sea.jpg",
        mime: "image/jpeg",
        bytes: bytes.length,
        hash: hash(bytes),
      };
    for (const metadata of [
      { ...m, filename: "../sea.jpg" },
      { ...m, filename: "C:\\sea.jpg" },
      { ...m, filename: "sea%2f.jpg" },
      { ...m, filename: "sea.png" },
      { ...m, object_key: "outside" },
      { ...m, mime: "image/svg+xml" },
      { ...m, hash: "0".repeat(64) },
    ])
      await expect(
        service.upload(alice, siteA, metadata, bytes),
      ).rejects.toThrow();
    expect(count("uploads")).toBe(0);
  });
  it("rejects forged image bytes, cleans failed upload files, and refuses spoofed dimensions", async () => {
    const bytes = Buffer.from("<script>not an image</script>");
    await expect(
      service.upload(
        alice,
        siteA,
        {
          filename: "bad.png",
          mime: "image/png",
          bytes: bytes.length,
          hash: hash(bytes),
        },
        bytes,
      ),
    ).rejects.toMatchObject({ code: "MEDIA" });
    expect(count("assets")).toBe(0);
    expect(await readdir(join(root, "originals"))).toEqual([]);
    const forged = Buffer.alloc(50);
    Buffer.from("89504e470d0a1a0a", "hex").copy(forged);
    forged.writeUInt32BE(13, 8);
    forged.write("IHDR", 12);
    forged.writeUInt32BE(90000, 16);
    forged.writeUInt32BE(90000, 20);
    expect(() => headerDimensions(forged, "image/png")).toThrow();
  });
  it("rejects non-decodable images that pass the bounded header boundary", async () => {
    const bytes = await readFile("public/media/sea.jpg");
    const truncated = Buffer.concat([
      bytes.subarray(0, 1000),
      Buffer.from([255, 217]),
    ]);
    await expect(
      new MacRasterInspector().inspect(truncated, "image/jpeg"),
    ).rejects.toThrow();
  });
  it("resumes a staged upload after reopen and cannot abort a committed original", async () => {
    const bytes = await readFile("public/media/sea.jpg");
    const u = await repo.stageUpload(alice, siteA, {
      filename: "sea.jpg",
      mime: "image/jpeg",
      bytes: bytes.length,
      hash: hash(bytes),
    });
    await objects.put(u.key, bytes);
    otherRepo = new SqliteRepository(dbPath);
    const recovery = new StudioService(
      otherRepo,
      objects,
      new MacRasterInspector(),
      publisher,
      {
        verify: async () => {
          throw Error("Not connected");
        },
      },
    );
    const a = await recovery.completeUpload(alice, u.id);
    await expect(recovery.abortUpload(alice, u.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(hash(await objects.read(a.key))).toBe(a.hash);
  });
  it("rejects escaping object paths, conflicting writes and symlink files", async () => {
    await expect(
      objects.put("../escape", new Uint8Array([1])),
    ).rejects.toMatchObject({ code: "INVALID" });
    const key = `${tenantA}/${siteA}/${randomUUID()}`;
    await objects.put(key, new Uint8Array([1]));
    await expect(objects.put(key, new Uint8Array([2]))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const trap = `${tenantA}/${siteA}/${randomUUID()}`;
    await symlink(
      join(root, "db.sqlite"),
      join(root, "originals", trap.replaceAll("/", "_")),
    );
    await expect(objects.read(trap)).rejects.toThrow();
  });
});
describe("verified domains and atomic publication", () => {
  it("retains studies in the private draft but excludes them from the verified local publication artifact", async () => {
    const draft = await repo.draft(alice, siteA);
    draft.document.pages[1] = beginCanvas(draft.document.pages[1]);
    draft.document.pages[1].studies![0].name =
      "Private studio possibility 83179";
    await repo.saveDraft(alice, siteA, draft.version, draft.document);
    await service.publish(alice, await request());
    const artifact = JSON.parse(
      Buffer.from(
        await service.readPublished("artist.example.test", "site.json"),
      ).toString(),
    );
    expect(artifact).toEqual(publicWebsite(draft.document));
    expect(
      (await repo.draft(alice, siteA)).document.pages[1].studies![0].name,
    ).toBe("Private studio possibility 83179");
  });
  it("rejects unverified, expired, revoked and cross-tenant domains, and prevents duplicate hostname claims", async () => {
    const d = await service.addDomain(alice, siteA, "Artist.Example.Test");
    const input = {
      siteId: siteA,
      domainId: d.id,
      expectedDraftVersion: 1,
      expectedGeneration: 0,
      approvedAssetIds: [],
      idempotencyKey: randomUUID(),
    };
    await expect(service.publish(alice, input)).rejects.toMatchObject({
      code: "UNVERIFIED",
    });
    domainPass = false;
    await expect(service.verifyDomain(alice, d.id)).rejects.toMatchObject({
      code: "UNVERIFIED",
    });
    domainPass = true;
    await service.verifyDomain(alice, d.id);
    await expect(service.verifyDomain(bob, d.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.addDomain(bob, siteB, "artist.example.test"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    now += 60001;
    await expect(service.publish(alice, input)).rejects.toMatchObject({
      code: "UNVERIFIED",
    });
    await repo.revokeDomain(alice, d.id);
    await expect(service.verifyDomain(alice, d.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  it("requires an exact approved media set, then activates a verified private artifact without exposing originals", async () => {
    const a = await withImage(),
      input = await request();
    await expect(service.publish(alice, input)).rejects.toMatchObject({
      code: "INVALID",
    });
    input.approvedAssetIds = [a.id];
    const receipt = await service.publish(alice, input);
    expect((await repo.head(alice, siteA)).releaseId).toBe(receipt.releaseId);
    expect(
      hash(await service.readPublished("artist.example.test", "media/" + a.id)),
    ).toBe(a.hash);
    await expect(
      service.readPublished("artist.example.test", "../originals"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.readPublished("artist.example.test", a.key),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await objects.remove(a.key);
    expect(
      hash(await service.readPublished("artist.example.test", "media/" + a.id)),
    ).toBe(a.hash);
  });
  it("fails missing/corrupt media before activation and preserves the previous head", async () => {
    const input = await request(),
      first = await service.publish(alice, input),
      a = await withImage();
    await objects.remove(a.key);
    await expect(
      service.publish(alice, {
        ...input,
        idempotencyKey: randomUUID(),
        expectedGeneration: 1,
        expectedDraftVersion: 2,
        approvedAssetIds: [a.id],
      }),
    ).rejects.toThrow();
    expect((await repo.head(alice, siteA)).releaseId).toBe(first.releaseId);
  });
  it("seals releases and history with database constraints", async () => {
    const receipt = await service.publish(alice, await request());
    const sql = new DatabaseSync(dbPath);
    try {
      expect(() =>
        sql
          .prepare("UPDATE releases SET document='{}' WHERE id=?")
          .run(receipt.releaseId),
      ).toThrow("Immutable");
      expect(() => sql.exec("DELETE FROM draft_history")).toThrow("Immutable");
      expect(() =>
        sql.exec("UPDATE publication_heads SET release_id=NULL"),
      ).toThrow("matching");
    } finally {
      sql.close();
    }
  });
  it("makes replay idempotent and rejects reusing a key for different approval", async () => {
    const input = await request(),
      first = await service.publish(alice, input);
    expect(await service.publish(alice, input)).toEqual(first);
    expect(count("releases")).toBe(1);
    await expect(
      service.publish(alice, { ...input, expectedDraftVersion: 2 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("allows one winner from concurrent publishers using separate database connections", async () => {
    const input = await request();
    otherRepo = new SqliteRepository(dbPath, () => now);
    let arrived = 0;
    let releaseGate!: () => void;
    const gate = new Promise<void>((r) => (releaseGate = r));
    const slow: Publisher = {
      ...publisher,
      prepare: async (j, m) => {
        if (++arrived === 2) releaseGate();
        await gate;
        return publisher.prepare(j, m);
      },
      verify: (a, j) => publisher.verify(a, j),
      discard: (a) => publisher.discard(a),
      read: (a, p) => publisher.read(a, p),
    };
    const verifier = {
        verify: async () => {
          throw Error("not needed");
        },
      },
      one = new StudioService(
        repo,
        objects,
        new MacRasterInspector(),
        slow,
        verifier,
      ),
      two = new StudioService(
        otherRepo,
        objects,
        new MacRasterInspector(),
        slow,
        verifier,
      );
    const result = await Promise.allSettled([
      one.publish(alice, input),
      two.publish(alice, { ...input, idempotencyKey: randomUUID() }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await repo.head(alice, siteA)).generation).toBe(1);
    expect(
      JSON.parse(
        Buffer.from(
          await service.readPublished("artist.example.test", "site.json"),
        ).toString(),
      ).name,
    ).toBe(initialSite.name);
  });
  it("handles concurrent retries of the same job without deleting the winner artifact", async () => {
    const input = await request();
    const [a, b] = await Promise.all([
      service.publish(alice, input),
      service.publish(alice, input),
    ]);
    expect(a).toEqual(b);
    expect((await repo.head(alice, siteA)).generation).toBe(1);
    await expect(
      service.readPublished("artist.example.test", "site.json"),
    ).resolves.toBeInstanceOf(Uint8Array);
  });
  it("rechecks domain status and draft approval after asynchronous preparation", async () => {
    const input = await request();
    const delayed: Publisher = {
      prepare: async (j, m) => {
        const out = await publisher.prepare(j, m);
        await repo.revokeDomain(alice, input.domainId);
        return out;
      },
      verify: (a, j) => publisher.verify(a, j),
      discard: (a) => publisher.discard(a),
      read: (a, p) => publisher.read(a, p),
    };
    const alternate = new StudioService(
      repo,
      objects,
      new MacRasterInspector(),
      delayed,
      {
        verify: async () => {
          throw Error();
        },
      },
    );
    await expect(alternate.publish(alice, input)).rejects.toMatchObject({
      code: "UNVERIFIED",
    });
    expect((await repo.head(alice, siteA)).generation).toBe(0);
  });
  it("rolls back transaction failure after artifact creation and leaves no active partial edition", async () => {
    const input = await request(),
      sql = new DatabaseSync(dbPath);
    sql.exec(
      "CREATE TRIGGER inject_event_failure BEFORE INSERT ON publication_events BEGIN SELECT RAISE(ABORT,'injected activation failure'); END",
    );
    try {
      await expect(service.publish(alice, input)).rejects.toThrow(
        "injected activation failure",
      );
      expect((await repo.head(alice, siteA)).generation).toBe(0);
      expect(count("publication_events")).toBe(0);
      expect(await readdir(join(root, "artifacts"))).toEqual([]);
    } finally {
      sql.close();
    }
  });
  it("recovers a pending publication after restart, then rollback advances generation and preserves the draft", async () => {
    const input = await request(),
      pending = await repo.reservePublication(alice, input);
    otherRepo = new SqliteRepository(dbPath, () => now);
    const recovered = new StudioService(
      otherRepo,
      objects,
      new MacRasterInspector(),
      publisher,
      {
        verify: async () => {
          throw Error();
        },
      },
    );
    const first = await recovered.resumePublication(alice, pending.id);
    const draft = emptySite();
    draft.name = "Second edition";
    await repo.saveDraft(alice, siteA, 1, draft);
    const second = await service.publish(alice, {
      ...input,
      idempotencyKey: randomUUID(),
      expectedDraftVersion: 2,
      expectedGeneration: 1,
    });
    expect(second.releaseId).not.toBe(first.releaseId);
    const head = await service.rollback(alice, siteA, first.jobId, 2);
    expect(head.generation).toBe(3);
    expect(head.releaseId).toBe(first.releaseId);
    expect((await repo.draft(alice, siteA)).document.name).toBe(
      "Second edition",
    );
    await expect(
      service.rollback(alice, siteA, second.jobId, 2),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await repo.revokeDomain(alice, input.domainId);
    await expect(
      service.readPublished("artist.example.test", "site.json"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("additional recovery and boundary evidence", () => {
  it("refuses altered migration checksums", () => {
    const sql = new DatabaseSync(dbPath);
    sql.exec(
      "UPDATE schema_migrations SET checksum='changed' WHERE version='001-foundation.sql'",
    );
    sql.close();
    expect(() => new SqliteRepository(dbPath)).toThrow("checksum changed");
  });
  it("rejects domains that are URLs, IPs, wildcards or path-like strings", async () => {
    for (const value of [
      "https://example.test",
      "127.0.0.1",
      "*.example.test",
      "example.test/path",
      "example.test:443",
      "localhost",
      "example.test.",
      "bad..test",
    ])
      await expect(
        service.addDomain(alice, siteA, value),
      ).rejects.toMatchObject({ code: "INVALID" });
    expect(count("domains")).toBe(0);
  });
  it("decodes an actual transparent PNG without trusting supplied metadata", async () => {
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const a = await service.upload(
      alice,
      siteA,
      {
        filename: "alpha.png",
        mime: "image/png",
        bytes: bytes.length,
        hash: hash(bytes),
      },
      bytes,
    );
    expect([a.width, a.height]).toEqual([1, 1]);
    expect(hash(await service.readOriginal(alice, siteA, a.id))).toBe(
      hash(bytes),
    );
  });
  it("rejects a raster original assigned to a film block", async () => {
    const a = await image(),
      d = emptySite();
    d.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      type: "video",
      assetId: a.id,
    });
    await expect(repo.saveDraft(alice, siteA, 1, d)).rejects.toMatchObject({
      code: "MEDIA",
    });
  });
  it("rejects stale approved drafts after artifact preparation", async () => {
    const input = await request();
    const changing: Publisher = {
      prepare: async (j, m) => {
        const out = await publisher.prepare(j, m);
        const d = emptySite();
        d.name = "Newer draft";
        await repo.saveDraft(alice, siteA, 1, d);
        return out;
      },
      verify: (a, j) => publisher.verify(a, j),
      discard: (a) => publisher.discard(a),
      read: (a, p) => publisher.read(a, p),
    };
    const svc = new StudioService(
      repo,
      objects,
      new MacRasterInspector(),
      changing,
      {
        verify: async () => {
          throw Error();
        },
      },
    );
    await expect(svc.publish(alice, input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect((await repo.head(alice, siteA)).generation).toBe(0);
    expect((await repo.draft(alice, siteA)).document.name).toBe("Newer draft");
  });
  it("cleans a partial publisher failure and retains the previous release", async () => {
    const input = await request(),
      first = await service.publish(alice, input),
      before = await readdir(join(root, "artifacts"));
    let writes = 0;
    const broken = new ManifestPublisher({
      read: (k) => artifacts.read(k),
      remove: (k) => artifacts.remove(k),
      put: async (k, b) => {
        if (++writes === 2) throw Error("Injected object write failure");
        await artifacts.put(k, b);
      },
    });
    const svc = new StudioService(
      repo,
      objects,
      new MacRasterInspector(),
      broken,
      {
        verify: async () => {
          throw Error();
        },
      },
    );
    await expect(
      svc.publish(alice, {
        ...input,
        idempotencyKey: randomUUID(),
        expectedGeneration: 1,
      }),
    ).rejects.toThrow("Injected object write");
    expect((await repo.head(alice, siteA)).releaseId).toBe(first.releaseId);
    expect(await readdir(join(root, "artifacts"))).toEqual(before);
  });
  it("refuses cross-tenant job reads, rollback and database-level ownership crossings", async () => {
    const receipt = await service.publish(alice, await request());
    await expect(repo.job(bob, receipt.jobId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.rollback(bob, siteB, receipt.jobId, 0),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const sql = new DatabaseSync(dbPath);
    try {
      expect(() =>
        sql
          .prepare("UPDATE drafts SET tenant_id=? WHERE site_id=?")
          .run(tenantB, siteA),
      ).toThrow("FOREIGN KEY");
    } finally {
      sql.close();
    }
  });
  it("blocks rollback to damaged artifacts and leaves the current head unchanged", async () => {
    const input = await request(),
      one = await service.publish(alice, input),
      two = await service.publish(alice, {
        ...input,
        idempotencyKey: randomUUID(),
        expectedGeneration: 1,
      });
    const job = await repo.job(alice, one.jobId);
    await writeFile(
      join(root, "artifacts", job.artifact!.key.replaceAll("/", "_")),
      "corrupted fixture",
    );
    await expect(
      service.rollback(alice, siteA, one.jobId, 2),
    ).rejects.toMatchObject({ code: "MEDIA" });
    expect((await repo.head(alice, siteA)).releaseId).toBe(two.releaseId);
  });
});

it("rejects an internally consistent artifact built from the wrong approved document", async () => {
  const input = await request();
  const incorrect: Publisher = {
    prepare: (j, m) => {
      const document = structuredClone(j.release.document);
      document.name = "Wrong edition";
      return publisher.prepare(
        { ...j, release: { ...j.release, document } },
        m,
      );
    },
    verify: (a, j) => publisher.verify(a, j),
    discard: (a) => publisher.discard(a),
    read: (a, p) => publisher.read(a, p),
  };
  const svc = new StudioService(
    repo,
    objects,
    new MacRasterInspector(),
    incorrect,
    {
      verify: async () => {
        throw Error();
      },
    },
  );
  await expect(svc.publish(alice, input)).rejects.toMatchObject({
    code: "MEDIA",
  });
  expect((await repo.head(alice, siteA)).generation).toBe(0);
  expect(await readdir(join(root, "artifacts"))).toEqual([]);
});

it("refuses a database from an unknown newer migration", () => {
  const sql = new DatabaseSync(dbPath);
  sql.exec("INSERT INTO schema_migrations VALUES('999-future.sql','unknown')");
  sql.close();
  expect(() => new SqliteRepository(dbPath)).toThrow("unknown migration");
});
