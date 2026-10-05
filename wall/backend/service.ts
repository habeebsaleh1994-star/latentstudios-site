import type {
  Repository,
  ObjectStore,
  Publisher,
  DomainVerifier,
  MediaInspector,
  Principal,
  Artifact,
  PublicationJob,
} from "./contracts";
import {
  fail,
  hash,
  parse,
  uploadSchema,
  publishSchema,
  hostname,
  idSchema,
} from "./validation";
/** In-process trusted service. No HTTP listener, cookie handling or mock-auth endpoint exists. */
export class StudioService {
  constructor(
    readonly repository: Repository,
    private originals: ObjectStore,
    private inspector: MediaInspector,
    private publisher: Publisher,
    private verifier: DomainVerifier,
  ) {}
  async upload(
    actor: Principal,
    siteId: string,
    metadata: unknown,
    bytes: Uint8Array,
  ) {
    parse(idSchema, siteId);
    const m = parse(uploadSchema, metadata);
    if (bytes.length !== m.bytes || hash(bytes) !== m.hash)
      fail("MEDIA", "Upload bytes do not match the declared size and hash.");
    const upload = await this.repository.stageUpload(actor, siteId, m);
    try {
      await this.originals.put(upload.key, bytes);
      return await this.completeUpload(actor, upload.id);
    } catch (error) {
      await this.abortUpload(actor, upload.id).catch(() => {});
      throw error;
    }
  }
  async completeUpload(actor: Principal, id: string) {
    parse(idSchema, id);
    const upload = await this.repository.upload(actor, id);
    if (upload.state === "aborted") fail("CONFLICT", "Upload was aborted.");
    if (upload.state === "committed")
      return this.repository.asset(actor, upload.siteId, id);
    const bytes = await this.originals.read(upload.key);
    if (bytes.length !== upload.bytes || hash(bytes) !== upload.hash)
      fail("MEDIA", "Stored upload integrity failure.");
    const dimensions = await this.inspector.inspect(bytes, upload.mime);
    return this.repository.finishUpload(actor, id, dimensions);
  }
  async abortUpload(actor: Principal, id: string) {
    const upload = await this.repository.upload(actor, id);
    await this.repository.abortUpload(actor, id);
    await this.originals.remove(upload.key);
  }
  async readOriginal(actor: Principal, siteId: string, id: string) {
    const asset = await this.repository.asset(actor, siteId, id),
      bytes = await this.originals.read(asset.key);
    if (hash(bytes) !== asset.hash || bytes.length !== asset.bytes)
      fail("MEDIA", "Original integrity failure.");
    return bytes;
  }
  async addDomain(actor: Principal, siteId: string, value: unknown) {
    return this.repository.addDomain(
      actor,
      parse(idSchema, siteId),
      hostname(value),
    );
  }
  async verifyDomain(actor: Principal, id: string) {
    const domain = await this.repository.domain(actor, parse(idSchema, id));
    const proof = await this.verifier.verify(domain.hostname, domain.challenge);
    if (!proof.verified)
      fail("UNVERIFIED", "Domain ownership has not been verified.");
    return this.repository.recordVerification(
      actor,
      id,
      domain.challenge,
      proof.evidence,
      proof.expiresAt,
    );
  }
  async publish(actor: Principal, raw: unknown) {
    const input = parse(publishSchema, raw),
      job = await this.repository.reservePublication(actor, input);
    return this.#finish(actor, job);
  }
  async resumePublication(actor: Principal, jobId: string) {
    return this.#finish(
      actor,
      await this.repository.job(actor, parse(idSchema, jobId)),
    );
  }
  async #finish(actor: Principal, job: PublicationJob) {
    const receipt = (j: PublicationJob) => ({
      jobId: j.id,
      releaseId: j.release.id,
      activatedGeneration: j.expectedGeneration + 1,
    });
    if (job.state === "committed") return receipt(job);
    if (job.state === "failed")
      return fail(
        "CONFLICT",
        "Failed publication is retained for inspection; submit a new request.",
      );
    let artifact: Artifact | undefined;
    try {
      const media = new Map<string, Uint8Array>();
      for (const asset of job.release.assets) {
        const bytes = await this.originals.read(asset.key);
        if (bytes.length !== asset.bytes || hash(bytes) !== asset.hash)
          fail("MEDIA", "A required original is missing or has changed.");
        media.set(asset.id, bytes);
      }
      artifact = await this.publisher.prepare(job, media);
      await this.publisher.verify(artifact, job);
      await this.repository.commitPublication(actor, job.id, artifact);
      return receipt(job);
    } catch (error) {
      const current = await this.repository
        .job(actor, job.id)
        .catch(() => null);
      if (current?.state === "committed") {
        if (artifact && artifact.key !== current.artifact?.key)
          await this.publisher.discard(artifact).catch(() => {});
        return receipt(current);
      }
      await this.repository
        .failPublication(
          actor,
          job.id,
          error instanceof Error ? error.name : "Publication failed",
        )
        .catch(() => {});
      if (artifact) await this.publisher.discard(artifact).catch(() => {});
      throw error;
    }
  }
  async rollback(
    actor: Principal,
    siteId: string,
    targetJobId: string,
    expected: number,
  ) {
    const job = await this.repository.job(actor, targetJobId);
    if (
      job.release.siteId !== siteId ||
      job.state !== "committed" ||
      !job.artifact
    )
      fail("NOT_FOUND", "Committed publication not found.");
    await this.publisher.verify(job.artifact, job);
    return this.repository.rollback(actor, siteId, targetJobId, expected);
  }
  async readPublished(value: unknown, path: string) {
    const job = await this.repository.resolvePublished(hostname(value));
    if (!job.artifact) fail("NOT_FOUND", "No active publication.");
    return this.publisher.read(job.artifact, path);
  }
}
