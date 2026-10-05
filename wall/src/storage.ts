import { database } from "./database";
export { database, type StoredDocument } from "./database";
import { readAsset, storeAsset } from "./mediaRepository";
export { readAsset, storeAsset } from "./mediaRepository";
import { z } from "zod";
import { initialSite, siteSchema, demoAssets, type Site } from "./model";
import { demoId, storyWorkspaceId, invalidStoryWorkspace } from "./workspace";
import { createSample } from "./samples";
// Abort all writes when any request fails, and consume the transaction rejection.
export async function atomic<T>(
  tx: { abort: () => void; done: Promise<void> },
  work: () => Promise<T>,
): Promise<T> {
  try {
    const result = await work();
    await tx.done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* already finished */
    }
    await tx.done.catch(() => {});
    throw error;
  }
}
export async function loadDocument(): Promise<{
  value: Site;
  revision: number;
}> {
  if (invalidStoryWorkspace)
    throw new Error(
      "This Story draft address is invalid. Return to your main draft or import its backup.",
    );
  const db = await database();
  const tx = db.transaction("documents", "readwrite");
  return atomic(tx, async () => {
    const record = await tx.store.get("site");
    if (!record) {
      if (storyWorkspaceId)
        throw new Error(
          "This imported Story draft is unavailable in this browser. Return to your main draft or import its backup.",
        );
      const seeded = {
        value: demoId ? createSample(demoId) : structuredClone(initialSite),
        revision: 1,
      };
      await tx.store.put(seeded, "site");
      await tx.done;
      return seeded;
    }
    await tx.done;
    return { value: siteSchema.parse(record.value), revision: record.revision };
  });
}
export async function saveDocument(
  value: Site,
  expectedRevision: number,
): Promise<number> {
  const validated = siteSchema.parse(value);
  const db = await database();
  const tx = db.transaction("documents", "readwrite");
  return atomic(tx, async () => {
    const current = await tx.store.get("site");
    if ((current?.revision ?? 0) !== expectedRevision) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        "This draft changed in another window. Export this version before reloading to keep both.",
      );
    }
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 13 &&
      !(await tx.objectStore("documents").get("pre-relationships"))
    )
      await tx.objectStore("documents").put(current, "pre-relationships");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 12 &&
      !(await tx.objectStore("documents").get("pre-caption-readability"))
    )
      await tx.objectStore("documents").put(current, "pre-caption-readability");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 11 &&
      !(await tx.objectStore("documents").get("pre-spatial-sections"))
    )
      await tx.objectStore("documents").put(current, "pre-spatial-sections");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 10 &&
      !(await tx.objectStore("documents").get("pre-local-expression"))
    )
      await tx.objectStore("documents").put(current, "pre-local-expression");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 9 &&
      !(await tx.objectStore("documents").get("pre-independent-viewports"))
    )
      await tx
        .objectStore("documents")
        .put(current, "pre-independent-viewports");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 8 &&
      !(await tx.objectStore("documents").get("pre-canvas-studies"))
    )
      await tx.objectStore("documents").put(current, "pre-canvas-studies");
    const revision = expectedRevision + 1;
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 7 &&
      !(await tx.objectStore("documents").get("pre-story-bridge"))
    )
      await tx.objectStore("documents").put(current, "pre-story-bridge");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 6 &&
      !(await tx.store.get("pre-ten-directions"))
    )
      await tx.store.put(current, "pre-ten-directions");
    if (
      current &&
      (current.value as { version?: number }).version === 1 &&
      !(await tx.store.get("pre-edition-two"))
    ) {
      await tx.store.put(current, "pre-edition-two");
    }
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 3 &&
      !(await tx.store.get("pre-identity-system"))
    )
      await tx.store.put(current, "pre-identity-system");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 4 &&
      !(await tx.store.get("pre-composition-system"))
    )
      await tx.store.put(current, "pre-composition-system");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 5 &&
      !(await tx.store.get("pre-publication-system"))
    )
      await tx.store.put(current, "pre-publication-system");
    await tx.store.put({ value: validated, revision }, "site");
    await tx.done;
    return revision;
  });
}
export const assetIds = (site: Site) => [
  ...new Set(
    site.pages
      .flatMap((p) => p.blocks.map((b) => b.assetId))
      .filter((id) => id && !Object.hasOwn(demoAssets, id)),
  ),
];
export const toDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the media file."));
    reader.readAsDataURL(blob);
  });
export async function exportBackup(
  site: Site,
  frozenAssets?: Record<string, Blob>,
) {
  const entries = await Promise.all(
    assetIds(site).map(async (id) => {
      const asset = frozenAssets ? frozenAssets[id] : await readAsset(id);
      if (!asset)
        throw new Error("A media file is missing. The backup was not created.");
      return [id, await toDataURL(asset)];
    }),
  );
  return JSON.stringify(
    {
      format: "latent-studio-backup",
      version: 13,
      site,
      assets: Object.fromEntries(entries),
    },
    null,
    2,
  );
}
// Only the three bundled geometric SVG originals are accepted in backups.
// Keep these hashes when adding later demo art; never allow arbitrary SVG markup.
const bundledVectorHashes = new Set([
  "a90e6263c4f0025f8caa59b89941bc6c63199c27b9325ab7b4be6ef20450f2d7",
  "efff593ea9045e97ed19ccc3ca11bebe943170e3e7e55cdd3f88a4681e358920",
  "900c341c826d222ba4bbf02a50f990679f881e272f6c4e7e67934de3b9ecdb69",
]);
export const freshAssetId = (source: string) =>
  source.startsWith("demo-frozen:")
    ? source.split(":").slice(0, 2).join(":") + ":" + crypto.randomUUID()
    : crypto.randomUUID();
const backupSchema = z.object({
  format: z.literal("latent-studio-backup"),
  version: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
    z.literal(8),
    z.literal(9),
    z.literal(10),
    z.literal(11),
    z.literal(12),
    z.literal(13),
  ]),
  site: siteSchema,
  assets: z.record(z.string(), z.string()),
});
export async function importBackup(text: string, expectedRevision: number) {
  if (text.length > 90 * 1024 * 1024)
    throw new Error("This backup is larger than the 90 MB local import limit.");
  const backup = (() => {
    try {
      return backupSchema.parse(JSON.parse(text));
    } catch {
      throw new Error(
        "This is not a valid Latent Studio backup. No draft was changed.",
      );
    }
  })();
  const assets: Record<string, Blob> = Object.create(null);
  for (const id of assetIds(backup.site)) {
    const data = Object.hasOwn(backup.assets, id)
      ? backup.assets[id]
      : undefined;
    const match = data?.match(
      /^data:(image\/(?:jpeg|png|webp|gif|svg\+xml)|video\/(?:mp4|webm));base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match)
      throw new Error(
        "The backup contains a missing or unsupported media file.",
      );
    const binary = atob(match[2]);
    if (binary.length > 30 * 1024 * 1024)
      throw new Error("A media file exceeds the 30 MB limit.");
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    if (match[1] === "image/svg+xml") {
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
      if (!bundledVectorHashes.has(hash))
        throw new Error(
          "Only the bundled demo vector originals are supported in a backup.",
        );
    }
    assets[id] = new Blob([bytes], {
      type: match[1],
    });
  }
  const db = await database();
  const tx = db.transaction(["documents", "assets"], "readwrite");
  return atomic(tx, async () => {
    const current = await tx.objectStore("documents").get("site");
    if ((current?.revision ?? 0) !== expectedRevision) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        "The draft changed in another window. Reload before importing.",
      );
    }
    if (current) {
      await tx
        .objectStore("documents")
        .put(current, `recovery:${Date.now()}:${crypto.randomUUID()}`);
      await tx.objectStore("documents").put(current, "before-restore");
    }
    const remapped = new Map<string, string>();
    for (const [id, blob] of Object.entries(assets)) {
      const destination = (await tx.objectStore("assets").getKey(id))
        ? freshAssetId(id)
        : id;
      remapped.set(id, destination);
      await tx.objectStore("assets").put(blob, destination);
    }
    const restoredSite = {
      ...backup.site,
      pages: backup.site.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) => ({
          ...b,
          assetId: remapped.get(b.assetId) ?? b.assetId,
        })),
      })),
    };
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 13 &&
      !(await tx.objectStore("documents").get("pre-relationships"))
    )
      await tx.objectStore("documents").put(current, "pre-relationships");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 12 &&
      !(await tx.objectStore("documents").get("pre-caption-readability"))
    )
      await tx.objectStore("documents").put(current, "pre-caption-readability");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 11 &&
      !(await tx.objectStore("documents").get("pre-spatial-sections"))
    )
      await tx.objectStore("documents").put(current, "pre-spatial-sections");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 10 &&
      !(await tx.objectStore("documents").get("pre-local-expression"))
    )
      await tx.objectStore("documents").put(current, "pre-local-expression");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 9 &&
      !(await tx.objectStore("documents").get("pre-independent-viewports"))
    )
      await tx
        .objectStore("documents")
        .put(current, "pre-independent-viewports");
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 8 &&
      !(await tx.objectStore("documents").get("pre-canvas-studies"))
    )
      await tx.objectStore("documents").put(current, "pre-canvas-studies");
    const revision = expectedRevision + 1;
    if (
      current &&
      ((current.value as { version?: number }).version ?? 0) < 7 &&
      !(await tx.objectStore("documents").get("pre-story-bridge"))
    )
      await tx.objectStore("documents").put(current, "pre-story-bridge");
    await tx
      .objectStore("documents")
      .put({ value: restoredSite, revision }, "site");
    await tx.done;
    return { value: restoredSite, revision };
  });
}

/** Local repository ports: future remote adapters must preserve these revision checks. */
export interface DraftRepository {
  load: typeof loadDocument;
  save: typeof saveDocument;
  importBackup: typeof importBackup;
}
export interface MediaRepository {
  read: typeof readAsset;
  store: typeof storeAsset;
}
export const localDrafts: DraftRepository = {
  load: loadDocument,
  save: saveDocument,
  importBackup,
};
export const localMedia: MediaRepository = {
  read: readAsset,
  store: storeAsset,
};
