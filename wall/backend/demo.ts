import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { initialSite } from "../src/model";
import { SqliteRepository } from "./sqlite";
import { PrivateFiles } from "./files";
import { ManifestPublisher } from "./publisher";
import { MacRasterInspector } from "./media";
import { StudioService } from "./service";
/** CLI-only synthetic scenario. Never imported by the browser or exposed as authentication. */
export async function runDemo() {
  const parent = resolve("docs/evidence");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(tmpdir(), "latent-backend-demo-"));
  const dbPath = join(root, "studio.sqlite");
  let repo = new SqliteRepository(dbPath);
  const originals = await PrivateFiles.create(join(root, "originals")),
    artifacts = await PrivateFiles.create(join(root, "artifacts")),
    publisher = new ManifestPublisher(artifacts);
  const verifier = {
    verify: async (host: string) => ({
      verified: host === "fixture.example.test",
      evidence: "SIMULATED-LOCAL-FIXTURE-NO-DNS",
      expiresAt: Date.now() + 3600000,
    }),
  };
  let service = new StudioService(
    repo,
    originals,
    new MacRasterInspector(),
    publisher,
    verifier,
  );
  const alice = { subject: "fixture:alice" },
    bob = { subject: "fixture:bob" };
  const evidence: { check: string; result: string }[] = [];
  const check = (name: string, okay: boolean) => {
    if (!okay) throw Error("Scenario failed: " + name);
    evidence.push({ check: name, result: "passed" });
  };
  const blocked = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      check(name, true);
      return;
    }
    throw Error("Expected rejection: " + name);
  };
  try {
    const tenant = await repo.createTenant(alice, "Fictional Studio A");
    await repo.createTenant(bob, "Fictional Studio B");
    const document = structuredClone(initialSite);
    document.pages = document.pages.map((p) => ({
      ...p,
      composition: null,
      blocks: p.blocks.filter((b) => b.type === "text"),
    }));
    const site = (await repo.createSite(alice, tenant, document)).siteId;
    await blocked("Cross-tenant draft read refused", () =>
      repo.draft(bob, site),
    );
    const bytes = await readFile("public/media/sea.jpg");
    const { hash } = await import("./validation");
    const asset = await service.upload(
      alice,
      site,
      {
        filename: "sea.jpg",
        mime: "image/jpeg",
        bytes: bytes.length,
        hash: hash(bytes),
      },
      bytes,
    );
    check(
      "Real JPEG decoding and exact original bytes",
      asset.width === 2000 &&
        hash(await service.readOriginal(alice, site, asset.id)) === hash(bytes),
    );
    document.pages[1].blocks.push({
      ...initialSite.pages[1].blocks[0],
      assetId: asset.id,
    });
    await repo.saveDraft(alice, site, 1, document);
    const domain = await service.addDomain(alice, site, "fixture.example.test");
    const request = {
      siteId: site,
      domainId: domain.id,
      expectedDraftVersion: 2,
      expectedGeneration: 0,
      approvedAssetIds: [asset.id],
      idempotencyKey: randomUUID(),
    };
    await blocked("Unverified-domain activation refused", () =>
      service.publish(alice, request),
    );
    await service.verifyDomain(alice, domain.id);
    const pending = await repo.reservePublication(alice, request);
    repo.close();
    repo = new SqliteRepository(dbPath);
    service = new StudioService(
      repo,
      originals,
      new MacRasterInspector(),
      publisher,
      verifier,
    );
    const first = await service.resumePublication(alice, pending.id);
    check(
      "Pending publication recovered after database reopen",
      (await repo.head(alice, site)).releaseId === first.releaseId,
    );
    document.name = "Second fictional edition";
    await repo.saveDraft(alice, site, 2, document);
    await service.publish(alice, {
      ...request,
      expectedDraftVersion: 3,
      expectedGeneration: 1,
      idempotencyKey: randomUUID(),
    });
    await service.rollback(alice, site, first.jobId, 2);
    check(
      "Rollback advances generation and preserves current draft",
      (await repo.head(alice, site)).generation === 3 &&
        (await repo.draft(alice, site)).document.name ===
          "Second fictional edition",
    );
    const published = await service.readPublished(
      "fixture.example.test",
      "site.json",
    );
    await writeFile(join(root, "published-site.json"), published);
    check(
      "Published data refers to the recovered first edition",
      JSON.parse(Buffer.from(published).toString()).name === initialSite.name,
    );
    await originals.remove(asset.key);
    await blocked("Missing original prevents later publication", () =>
      service.publish(alice, {
        ...request,
        expectedDraftVersion: 3,
        expectedGeneration: 3,
        idempotencyKey: randomUUID(),
      }),
    );
    check(
      "Previously activated artifact survives original loss",
      hash(
        await service.readPublished(
          "fixture.example.test",
          "media/" + asset.id,
        ),
      ) === asset.hash,
    );
    const report = {
      scope:
        "Real local SQLite/files, simulated identity/domain proof, no network listener or hosting",
      root,
      dbPath,
      checks: evidence,
      head: await repo.head(alice, site),
    };
    await writeFile(
      join(root, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    await writeFile(
      resolve("docs/evidence/backend-demo-latest.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    return report;
  } finally {
    repo.close();
  }
}
