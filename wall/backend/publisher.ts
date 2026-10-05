import { publicWebsite } from "../src/compositionStudies";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  Publisher,
  ObjectStore,
  PublicationJob,
  Artifact,
} from "./contracts";
import { assertKey, fail, hash, parse } from "./validation";
const manifestSchema = z
  .object({
    version: z.literal(1),
    jobId: z.string().uuid(),
    releaseId: z.string().uuid(),
    files: z
      .array(
        z
          .object({
            path: z.string(),
            key: z.string(),
            hash: z.string().regex(/^[a-f0-9]{64}$/),
            bytes: z.number().int().positive(),
          })
          .strict(),
      )
      .max(5001),
  })
  .strict();
/** Real private file artifact, not a deployed website. A renderer adapter remains a separate step. */
export class ManifestPublisher implements Publisher {
  constructor(private files: ObjectStore) {}
  async prepare(
    job: PublicationJob,
    media: ReadonlyMap<string, Uint8Array>,
  ): Promise<Artifact> {
    const created: string[] = [],
      entries: z.infer<typeof manifestSchema>["files"] = [];
    const store = async (path: string, bytes: Uint8Array) => {
      const key = `${job.release.tenantId}/${job.release.siteId}/${randomUUID()}`;
      created.push(key);
      await this.files.put(key, bytes);
      entries.push({ path, key, hash: hash(bytes), bytes: bytes.length });
    };
    try {
      await store(
        "site.json",
        Buffer.from(JSON.stringify(publicWebsite(job.release.document))),
      );
      for (const asset of job.release.assets) {
        const bytes = media.get(asset.id);
        if (!bytes || hash(bytes) !== asset.hash)
          fail("MEDIA", "Publisher is missing approved media.");
        await store("media/" + asset.id, bytes);
      }
      const bytes = Buffer.from(
          JSON.stringify({
            version: 1,
            jobId: job.id,
            releaseId: job.release.id,
            files: entries,
          }),
        ),
        key = `${job.release.tenantId}/${job.release.siteId}/${randomUUID()}`;
      created.push(key);
      await this.files.put(key, bytes);
      return { key, hash: hash(bytes), bytes: bytes.length };
    } catch (error) {
      await Promise.allSettled(created.map((k) => this.files.remove(k)));
      throw error;
    }
  }
  async #manifest(artifact: Artifact) {
    assertKey(artifact.key);
    const bytes = await this.files.read(artifact.key);
    if (bytes.length !== artifact.bytes || hash(bytes) !== artifact.hash)
      fail("MEDIA", "Publication manifest integrity failure.");
    const m = parse(manifestSchema, JSON.parse(Buffer.from(bytes).toString()));
    const paths = new Set<string>();
    for (const f of m.files) {
      assertKey(f.key);
      if (
        f.key.split("/").slice(0, 2).join("/") !==
          artifact.key.split("/").slice(0, 2).join("/") ||
        !(f.path === "site.json" || /^media\/[a-f0-9-]{36}$/.test(f.path)) ||
        paths.has(f.path)
      )
        fail("MEDIA", "Invalid publication manifest path.");
      paths.add(f.path);
    }
    return m;
  }
  async verify(artifact: Artifact, job: PublicationJob) {
    const m = await this.#manifest(artifact);
    const expected = new Map([
      [
        "site.json",
        {
          hash: hash(JSON.stringify(publicWebsite(job.release.document))),
          bytes: Buffer.byteLength(
            JSON.stringify(publicWebsite(job.release.document)),
          ),
        },
      ],
      ...job.release.assets.map(
        (a) => ["media/" + a.id, { hash: a.hash, bytes: a.bytes }] as const,
      ),
    ]);
    if (
      m.jobId !== job.id ||
      m.releaseId !== job.release.id ||
      m.files.length !== expected.size ||
      artifact.key.split("/").slice(0, 2).join("/") !==
        `${job.release.tenantId}/${job.release.siteId}`
    )
      fail(
        "MEDIA",
        "Publication artifact does not match the approved release.",
      );
    for (const f of m.files) {
      const required = expected.get(f.path);
      if (!required || f.hash !== required.hash || f.bytes !== required.bytes)
        fail("MEDIA", "Publication file differs from the approved release.");
      const bytes = await this.files.read(f.key);
      if (bytes.length !== f.bytes || hash(bytes) !== f.hash)
        fail("MEDIA", "Publication file integrity failure.");
    }
  }
  async read(artifact: Artifact, path: string) {
    const m = await this.#manifest(artifact),
      f = m.files.find((f) => f.path === path);
    if (!f) return fail("NOT_FOUND", "No published file at this path.");
    const bytes = await this.files.read(f.key);
    if (bytes.length !== f.bytes || hash(bytes) !== f.hash)
      fail("MEDIA", "Publication file integrity failure.");
    return bytes;
  }
  async discard(artifact: Artifact) {
    const m = await this.#manifest(artifact);
    await Promise.all(m.files.map((f) => this.files.remove(f.key)));
    await this.files.remove(artifact.key);
  }
}
