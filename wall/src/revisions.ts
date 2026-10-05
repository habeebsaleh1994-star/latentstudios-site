import {
  freshAssetId,
  database,
  atomic,
  readAsset,
  type StoredDocument,
} from "./storage";
import { demoAssets, siteSchema, type Site } from "./model";
import { preflight } from "./preflight";
import { allMediaIds, isDemoAsset } from "./publication";
export interface MediaManifestEntry {
  id: string;
  type: string;
  bytes: number;
  missing: boolean;
  width?: number;
  height?: number;
  duration?: number;
}
export interface Revision {
  format: "latent-studio-revision";
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  sourceRevision: number;
  site: Site;
  assets: Record<string, Blob>;
  manifest: MediaManifestEntry[];
}
export interface RevisionSummary {
  id: string;
  name: string;
  createdAt: string;
  sourceRevision: number;
  legacy: boolean;
}
export interface RevisionLibrary {
  revisions: RevisionSummary[];
  releaseId: string | null;
}
export interface RevisionRepository {
  list(): Promise<RevisionLibrary>;
  read(id: string): Promise<Revision>;
  checkpoint(
    site: Site,
    expectedRevision: number,
    name: string,
    release?: { expectedId: string | null },
  ): Promise<Revision>;
  restore(
    id: string,
    expectedRevision: number,
  ): Promise<{ value: Site; revision: number }>;
}
const legacyNames: Record<string, string> = {
  "pre-relationships": "Before composition intentions",
  "pre-caption-readability": "Before caption treatments",
  "pre-spatial-sections": "Before spatial sections",
  "pre-local-expression": "Before local typography and fine proportions",
  "pre-independent-viewports": "Before independent device arrangements",
  "pre-canvas-studies": "Before canvas studies",
  "pre-edition-two": "Before four styles",
  "pre-identity-system": "Before visual identity",
  "pre-composition-system": "Before composition",
  "pre-ten-directions": "Before ten directions",
  "pre-story-bridge": "Before Story imports",
  "pre-publication-system": "Before release tools",
  "before-restore": "Previous backup restore",
};
export async function collectMedia(site: Site, signal?: AbortSignal) {
  const assets: Record<string, Blob> = Object.create(null);
  const manifest: MediaManifestEntry[] = [];
  let bytes = 0;
  for (const id of allMediaIds(site)) {
    signal?.throwIfAborted();
    let blob: Blob | undefined;
    if (isDemoAsset(id)) {
      try {
        const r = await fetch(demoAssets[id], {
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        });
        if (r.ok) blob = await r.blob();
      } catch {
        signal?.throwIfAborted();
        /* missing is recorded, never silently replaced */
      }
    } else blob = await readAsset(id);
    if (blob) {
      bytes += blob.size;
      assets[id] = blob;
    }
    if (bytes > 60 * 1024 * 1024)
      throw new Error(
        "This local revision exceeds 60 MB of media. Export your draft backup and reduce the media size before making a checkpoint.",
      );
    manifest.push({
      id,
      type: blob?.type ?? "",
      bytes: blob?.size ?? 0,
      missing: !blob,
    });
  }
  return { assets, manifest };
}
const makeRevision = (
  site: Site,
  revision: number,
  name: string,
  media: Awaited<ReturnType<typeof collectMedia>>,
): Revision => ({
  format: "latent-studio-revision",
  version: 1,
  id: crypto.randomUUID(),
  name: name.trim().slice(0, 120) || "Untitled checkpoint",
  createdAt: new Date().toISOString(),
  sourceRevision: revision,
  site: siteSchema.parse(site),
  ...media,
});
function isLegacy(key: string) {
  return Object.hasOwn(legacyNames, key) || key.startsWith("recovery:");
}
async function list(): Promise<RevisionLibrary> {
  const db = await database();
  const tx = db.transaction("documents");
  const keys = await tx.store.getAllKeys(),
    records = await tx.store.getAll();
  await tx.done;
  const revisions: RevisionSummary[] = [];
  let releaseId: string | null = null;
  keys.forEach((key, i) => {
    const record = records[i];
    if (key === "local-release")
      releaseId = (record.value as { id: string }).id;
    else if (key.startsWith("revision:")) {
      const r = record.value as Revision;
      revisions.push({
        id: key,
        name: r.name,
        createdAt: r.createdAt,
        sourceRevision: r.sourceRevision,
        legacy: false,
      });
    } else if (isLegacy(key))
      revisions.push({
        id: key,
        name: legacyNames[key] ?? "Before backup import",
        createdAt: key.startsWith("recovery:")
          ? new Date(Number(key.split(":")[1])).toISOString()
          : "",
        sourceRevision: record.revision,
        legacy: true,
      });
  });
  return {
    revisions: revisions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    releaseId,
  };
}
async function read(id: string): Promise<Revision> {
  const record = await (await database()).get("documents", id);
  if (!record || (!id.startsWith("revision:") && !isLegacy(id)))
    throw new Error(
      "This recovery point is unavailable. Your draft has not changed.",
    );
  if (id.startsWith("revision:")) {
    const r = record.value as Revision;
    return { ...r, site: siteSchema.parse(r.site) };
  }
  const site = siteSchema.parse(record.value);
  return {
    ...makeRevision(
      site,
      record.revision,
      legacyNames[id] ?? "Before backup import",
      await collectMedia(site),
    ),
    id,
    createdAt: "",
  };
}
async function checkpoint(
  site: Site,
  expectedRevision: number,
  name: string,
  release?: { expectedId: string | null },
) {
  const r = makeRevision(
    site,
    expectedRevision,
    name,
    await collectMedia(site),
  );
  if (release) {
    const issues = await preflight(r);
    if (issues.some((i) => i.severity === "error"))
      throw new Error(
        "Preflight found problems. Review and resolve them before creating a local release.",
      );
  }
  const db = await database();
  const tx = db.transaction("documents", "readwrite");
  return atomic(tx, async () => {
    const current = await tx.store.get("site");
    const pointer = await tx.store.get("local-release");
    if (
      current?.revision !== expectedRevision ||
      JSON.stringify(siteSchema.parse(current.value)) !==
        JSON.stringify(r.site) ||
      (release &&
        ((pointer?.value as { id: string } | undefined)?.id ?? null) !==
          release.expectedId)
    ) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        "The draft or local release changed in another window. Reload before continuing.",
      );
    }
    await tx.store.add(
      { value: r, revision: expectedRevision },
      `revision:${r.id}`,
    );
    if (release)
      await tx.store.put(
        { value: { id: `revision:${r.id}` }, revision: expectedRevision },
        "local-release",
      );
    await tx.done;
    return r;
  });
}
async function restore(id: string, expectedRevision: number) {
  const r = await read(id);
  if (r.manifest.some((m) => m.missing))
    throw new Error(
      "This recovery point has missing media. Export the current draft and repair the media before restoring.",
    );
  const db = await database();
  const current = await db.get("documents", "site");
  if (!current || current.revision !== expectedRevision)
    throw new Error(
      "The draft changed in another window. Reload before restoring.",
    );
  const before = makeRevision(
    siteSchema.parse(current.value),
    expectedRevision,
    "Before restoring " + r.name,
    await collectMedia(siteSchema.parse(current.value)),
  );
  const tx = db.transaction(["documents", "assets"], "readwrite");
  return atomic(tx, async () => {
    const latest = await tx.objectStore("documents").get("site");
    if (latest?.revision !== expectedRevision) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        "The draft changed in another window. Reload before restoring.",
      );
    }
    if (
      ((latest.value as { version?: number }).version ?? 0) < 12 &&
      !(await tx.objectStore("documents").get("pre-caption-readability"))
    )
      await tx.objectStore("documents").put(latest, "pre-caption-readability");
    if (
      ((latest.value as { version?: number }).version ?? 0) < 11 &&
      !(await tx.objectStore("documents").get("pre-spatial-sections"))
    )
      await tx.objectStore("documents").put(latest, "pre-spatial-sections");
    if (
      ((latest.value as { version?: number }).version ?? 0) < 10 &&
      !(await tx.objectStore("documents").get("pre-local-expression"))
    )
      await tx.objectStore("documents").put(latest, "pre-local-expression");
    if (
      ((latest.value as { version?: number }).version ?? 0) < 9 &&
      !(await tx.objectStore("documents").get("pre-independent-viewports"))
    )
      await tx
        .objectStore("documents")
        .put(latest, "pre-independent-viewports");
    const mapping = new Map<string, string>();
    for (const [assetId, blob] of Object.entries(r.assets)) {
      const newId = isDemoAsset(assetId)
        ? `demo-frozen:${assetId}:${crypto.randomUUID()}`
        : freshAssetId(assetId);
      mapping.set(assetId, newId);
      await tx.objectStore("assets").add(blob, newId);
    }
    const value: Site = {
      ...r.site,
      pages: r.site.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) => ({
          ...b,
          assetId: mapping.get(b.assetId) ?? b.assetId,
        })),
      })),
    };
    const revision = expectedRevision + 1;
    await tx
      .objectStore("documents")
      .add(
        { value: before, revision: expectedRevision },
        `revision:${before.id}`,
      );
    await tx
      .objectStore("documents")
      .put({ value, revision } satisfies StoredDocument, "site");
    await tx.done;
    return { value, revision };
  });
}
export const localRevisions: RevisionRepository = {
  list,
  read,
  checkpoint,
  restore,
};
