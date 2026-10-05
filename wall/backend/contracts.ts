import type { Site } from "../src/model";
/** Trusted authentication boundary. Never construct from request body/tenant headers. */
export interface Principal {
  subject: string;
}
export interface Authenticator {
  authenticate(credential: unknown): Promise<Principal>;
}
export type Role = "owner" | "editor" | "viewer";
export interface Draft {
  siteId: string;
  version: number;
  document: Site;
  hash: string;
}
export interface Asset {
  id: string;
  tenantId: string;
  siteId: string;
  key: string;
  hash: string;
  bytes: number;
  mime: string;
  width: number;
  height: number;
}
export interface Upload {
  id: string;
  siteId: string;
  tenantId: string;
  key: string;
  hash: string;
  bytes: number;
  mime: string;
  filename: string;
  state: "staged" | "committed" | "aborted";
}
export interface Domain {
  id: string;
  tenantId: string;
  siteId: string;
  hostname: string;
  challenge: string;
  state: "pending" | "verified" | "revoked";
  expiresAt: number | null;
}
export interface Head {
  generation: number;
  releaseId: string | null;
  jobId: string | null;
  domainId: string | null;
}
export interface Release {
  id: string;
  tenantId: string;
  siteId: string;
  sourceVersion: number;
  document: Site;
  hash: string;
  assets: Asset[];
}
export interface PublicationRequest {
  siteId: string;
  domainId: string;
  expectedDraftVersion: number;
  expectedGeneration: number;
  approvedAssetIds: string[];
  idempotencyKey: string;
}
export interface PublicationJob {
  id: string;
  release: Release;
  domainId: string;
  expectedGeneration: number;
  state: "pending" | "committed" | "failed";
  artifact: Artifact | null;
}
export interface Artifact {
  key: string;
  hash: string;
  bytes: number;
}
export interface UploadMetadata {
  filename: string;
  mime: string;
  bytes: number;
  hash: string;
}
export interface MediaInspector {
  inspect(
    bytes: Uint8Array,
    mime: string,
  ): Promise<{ width: number; height: number }>;
}
/** Private immutable objects. Provider adapter must enforce key ownership and conditional create. */
export interface ObjectStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
/** No public network side effect: prepare a sealed artifact before the database activation. */
export interface Publisher {
  prepare(
    job: PublicationJob,
    media: ReadonlyMap<string, Uint8Array>,
  ): Promise<Artifact>;
  verify(artifact: Artifact, job: PublicationJob): Promise<void>;
  discard(artifact: Artifact): Promise<void>;
  read(artifact: Artifact, path: string): Promise<Uint8Array>;
}
/** Verify through a trusted provider/DNS adapter, never through caller-supplied status. */
export interface DomainVerifier {
  verify(
    hostname: string,
    challenge: string,
  ): Promise<{ verified: boolean; evidence: string; expiresAt: number }>;
}
/** Operation-level port: each mutation promises authorization + constraints in one transaction. */
export interface Repository {
  createTenant(actor: Principal, name: string): Promise<string>;
  createSite(
    actor: Principal,
    tenantId: string,
    document: Site,
  ): Promise<Draft>;
  grant(
    actor: Principal,
    tenantId: string,
    subject: string,
    role: Exclude<Role, "owner">,
  ): Promise<void>;
  draft(actor: Principal, siteId: string): Promise<Draft>;
  saveDraft(
    actor: Principal,
    siteId: string,
    expected: number,
    document: Site,
  ): Promise<Draft>;
  restoreDraft(
    actor: Principal,
    siteId: string,
    version: number,
    expected: number,
  ): Promise<Draft>;
  stageUpload(
    actor: Principal,
    siteId: string,
    metadata: UploadMetadata,
  ): Promise<Upload>;
  upload(actor: Principal, uploadId: string): Promise<Upload>;
  finishUpload(
    actor: Principal,
    uploadId: string,
    dimensions: { width: number; height: number },
  ): Promise<Asset>;
  abortUpload(actor: Principal, uploadId: string): Promise<void>;
  asset(actor: Principal, siteId: string, id: string): Promise<Asset>;
  addDomain(
    actor: Principal,
    siteId: string,
    hostname: string,
  ): Promise<Domain>;
  domain(actor: Principal, id: string): Promise<Domain>;
  recordVerification(
    actor: Principal,
    id: string,
    challenge: string,
    evidence: string,
    expiresAt: number,
  ): Promise<Domain>;
  revokeDomain(actor: Principal, id: string): Promise<void>;
  reservePublication(
    actor: Principal,
    input: PublicationRequest,
  ): Promise<PublicationJob>;
  commitPublication(
    actor: Principal,
    jobId: string,
    artifact: Artifact,
  ): Promise<Head>;
  failPublication(
    actor: Principal,
    jobId: string,
    reason: string,
  ): Promise<void>;
  job(actor: Principal, jobId: string): Promise<PublicationJob>;
  head(actor: Principal, siteId: string): Promise<Head>;
  rollback(
    actor: Principal,
    siteId: string,
    targetJobId: string,
    expectedGeneration: number,
  ): Promise<Head>;
  resolvePublished(hostname: string): Promise<PublicationJob>;
}
