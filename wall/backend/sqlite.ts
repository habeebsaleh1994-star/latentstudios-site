import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Site } from "../src/model";
import type {
  Repository,
  Principal,
  Role,
  Draft,
  Asset,
  Upload,
  Domain,
  PublicationRequest,
  PublicationJob,
  Release,
  Artifact,
  Head,
  UploadMetadata,
} from "./contracts";
import {
  fail,
  hash,
  documentInput,
  references,
  publicationDocument,
  parse,
  uploadSchema,
  publishSchema,
  hostname as normalizeHostname,
  assertKey,
} from "./validation";
type Row = Record<string, string | number | null>;
export class SqliteRepository implements Repository {
  #db: DatabaseSync;
  constructor(
    filename: string,
    private now: () => number = Date.now,
    migrations = resolve("backend/migrations"),
  ) {
    this.#db = new DatabaseSync(filename, {
      timeout: 3000,
      enableForeignKeyConstraints: true,
    });
    try {
      this.#db.exec(
        "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;",
      );
      this.#db.exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, checksum TEXT NOT NULL) STRICT",
      );
      const available = readdirSync(migrations)
        .filter((n) => /^\d{3}-[a-z-]+\.sql$/.test(n))
        .sort();
      for (const applied of this.#db
        .prepare("SELECT version FROM schema_migrations")
        .all())
        if (!available.includes(String(applied.version)))
          fail(
            "CONFLICT",
            "Database has an unknown migration; use the matching backend version.",
          );
      for (const name of available) {
        const sql = readFileSync(resolve(migrations, name), "utf8"),
          checksum = hash(sql);
        this.#tx(() => {
          const prior = this.#one(
            "SELECT checksum FROM schema_migrations WHERE version=?",
            name,
          );
          if (prior) {
            if (prior.checksum !== checksum)
              fail("CONFLICT", "Migration checksum changed: " + name);
            return;
          }
          this.#db.exec(sql);
          this.#run(
            "INSERT INTO schema_migrations VALUES(?,?)",
            name,
            checksum,
          );
        });
      }
    } catch (error) {
      this.#db.close();
      throw error;
    }
  }
  close() {
    this.#db.close();
  }
  #one(sql: string, ...params: SQLInputValue[]) {
    return this.#db.prepare(sql).get(...params) as Row | undefined;
  }
  #run(sql: string, ...params: SQLInputValue[]) {
    return this.#db.prepare(sql).run(...params);
  }
  #tx<T>(fn: () => T): T {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.#db.exec("COMMIT");
      return value;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }
  #role(actor: Principal, tenantId: string, write = false, owner = false) {
    if (
      !actor ||
      typeof actor.subject !== "string" ||
      !actor.subject ||
      actor.subject.length > 200
    )
      fail("FORBIDDEN", "Authentication required.");
    const member = this.#one(
      "SELECT role FROM memberships WHERE tenant_id=? AND subject=?",
      tenantId,
      actor.subject,
    );
    if (!member) fail("NOT_FOUND", "Resource not found.");
    if (
      (write && member.role === "viewer") ||
      (owner && member.role !== "owner")
    )
      fail("FORBIDDEN", "This action requires a different site role.");
  }
  #site(actor: Principal, id: string, write = false, owner = false) {
    const s = this.#one("SELECT * FROM sites WHERE id=?", id);
    if (!s) return fail("NOT_FOUND", "Resource not found.");
    this.#role(actor, String(s.tenant_id), write, owner);
    return s;
  }
  #draft(siteId: string): Draft {
    const d = this.#one("SELECT * FROM drafts WHERE site_id=?", siteId)!;
    return {
      siteId,
      version: Number(d.version),
      document: JSON.parse(String(d.document)),
      hash: String(d.hash),
    };
  }
  #asset(row: Row): Asset {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      siteId: String(row.site_id),
      key: String(row.object_key),
      hash: String(row.hash),
      bytes: Number(row.bytes),
      mime: String(row.mime),
      width: Number(row.width),
      height: Number(row.height),
    };
  }
  #assets(siteId: string, doc: Site) {
    return references(doc).map((id) => {
      const a = this.#one(
        "SELECT * FROM assets WHERE site_id=? AND id=?",
        siteId,
        id,
      );
      if (!a)
        return fail(
          "MEDIA",
          "Referenced media is missing or belongs to another site.",
        );
      for (const page of doc.pages)
        for (const block of page.blocks)
          if (
            block.assetId === id &&
            ((block.type === "image" && !String(a.mime).startsWith("image/")) ||
              (block.type === "video" && !String(a.mime).startsWith("video/")))
          )
            fail("MEDIA", "Media type does not match its content block.");
      return this.#asset(a);
    });
  }
  #writeDraft(actor: Principal, site: Row, expected: number, document: Site) {
    const id = String(site.id),
      current = this.#draft(id);
    if (current.version !== expected)
      fail("CONFLICT", "Draft revision changed.");
    this.#assets(id, document);
    const serialized = JSON.stringify(document),
      digest = hash(serialized),
      version = expected + 1;
    this.#run(
      "UPDATE drafts SET version=?,document=?,hash=? WHERE site_id=?",
      version,
      serialized,
      digest,
      id,
    );
    this.#run(
      "INSERT INTO draft_history VALUES(?,?,?,?,?,?)",
      id,
      site.tenant_id,
      version,
      serialized,
      digest,
      actor.subject,
    );
    return this.#draft(id);
  }
  async createTenant(actor: Principal, name: string) {
    return this.#tx(() => {
      if (!/^[A-Za-z0-9:_-]{1,200}$/.test(actor?.subject ?? ""))
        fail("FORBIDDEN", "Authentication required.");
      if (!name.trim() || name.length > 120)
        fail("INVALID", "Invalid studio name.");
      const id = randomUUID();
      this.#run("INSERT OR IGNORE INTO principals VALUES(?)", actor.subject);
      this.#run("INSERT INTO tenants VALUES(?,?,?)", id, name, actor.subject);
      this.#run(
        "INSERT INTO memberships VALUES(?,?,?)",
        id,
        actor.subject,
        "owner",
      );
      return id;
    });
  }
  async grant(
    actor: Principal,
    tenantId: string,
    subject: string,
    role: Exclude<Role, "owner">,
  ) {
    this.#tx(() => {
      this.#role(actor, tenantId, false, true);
      if (
        !/^[A-Za-z0-9:_-]{1,200}$/.test(subject) ||
        !["editor", "viewer"].includes(role)
      )
        fail("INVALID", "Invalid membership.");
      const owner = this.#one(
        "SELECT owner_subject FROM tenants WHERE id=?",
        tenantId,
      )!;
      if (owner.owner_subject === subject)
        fail("INVALID", "Cannot demote the studio owner.");
      this.#run("INSERT OR IGNORE INTO principals VALUES(?)", subject);
      this.#run(
        "INSERT INTO memberships VALUES(?,?,?) ON CONFLICT(tenant_id,subject) DO UPDATE SET role=excluded.role",
        tenantId,
        subject,
        role,
      );
    });
  }
  async createSite(actor: Principal, tenantId: string, raw: Site) {
    const document = documentInput(raw);
    return this.#tx(() => {
      this.#role(actor, tenantId, true);
      if (references(document).length)
        fail("INVALID", "Create an empty site before importing its media.");
      const id = randomUUID(),
        serialized = JSON.stringify(document),
        digest = hash(serialized);
      this.#run("INSERT INTO sites VALUES(?,?)", id, tenantId);
      this.#run(
        "INSERT INTO drafts VALUES(?,?,?,?,?)",
        id,
        tenantId,
        1,
        serialized,
        digest,
      );
      this.#run(
        "INSERT INTO draft_history VALUES(?,?,?,?,?,?)",
        id,
        tenantId,
        1,
        serialized,
        digest,
        actor.subject,
      );
      this.#run(
        "INSERT INTO publication_heads VALUES(?,?,0,NULL,NULL,NULL)",
        id,
        tenantId,
      );
      return this.#draft(id);
    });
  }
  async draft(actor: Principal, id: string) {
    this.#site(actor, id);
    return this.#draft(id);
  }
  async saveDraft(actor: Principal, id: string, expected: number, raw: Site) {
    const document = documentInput(raw);
    return this.#tx(() =>
      this.#writeDraft(actor, this.#site(actor, id, true), expected, document),
    );
  }
  async restoreDraft(
    actor: Principal,
    id: string,
    version: number,
    expected: number,
  ) {
    return this.#tx(() => {
      const site = this.#site(actor, id, true),
        prior = this.#one(
          "SELECT document FROM draft_history WHERE site_id=? AND version=?",
          id,
          version,
        );
      if (!prior) return fail("NOT_FOUND", "Draft revision not found.");
      return this.#writeDraft(
        actor,
        site,
        expected,
        documentInput(JSON.parse(String(prior.document))),
      );
    });
  }
  #upload(row: Row): Upload {
    return {
      id: String(row.id),
      siteId: String(row.site_id),
      tenantId: String(row.tenant_id),
      key: String(row.object_key),
      hash: String(row.hash),
      bytes: Number(row.bytes),
      mime: String(row.mime),
      filename: String(row.filename),
      state: row.state as Upload["state"],
    };
  }
  async stageUpload(actor: Principal, siteId: string, m: UploadMetadata) {
    m = parse(uploadSchema, m);
    return this.#tx(() => {
      const s = this.#site(actor, siteId, true),
        id = randomUUID(),
        key = `${s.tenant_id}/${siteId}/${id}`;
      this.#run(
        "INSERT INTO uploads VALUES(?,?,?,?,?,?,?,?,?,?)",
        id,
        s.tenant_id,
        siteId,
        actor.subject,
        key,
        m.hash,
        m.bytes,
        m.mime,
        m.filename,
        "staged",
      );
      return this.#upload(this.#one("SELECT * FROM uploads WHERE id=?", id)!);
    });
  }
  async upload(actor: Principal, id: string) {
    const row = this.#one("SELECT * FROM uploads WHERE id=?", id);
    if (!row) return fail("NOT_FOUND", "Resource not found.");
    this.#site(actor, String(row.site_id), true);
    return this.#upload(row);
  }
  async finishUpload(
    actor: Principal,
    id: string,
    d: { width: number; height: number },
  ) {
    return this.#tx(() => {
      const row = this.#one("SELECT * FROM uploads WHERE id=?", id);
      if (!row) return fail("NOT_FOUND", "Resource not found.");
      this.#site(actor, String(row.site_id), true);
      if (row.state === "aborted") fail("CONFLICT", "Upload was aborted.");
      if (row.state === "committed")
        return this.#asset(this.#one("SELECT * FROM assets WHERE id=?", id)!);
      this.#run(
        "INSERT INTO assets VALUES(?,?,?,?,?,?,?,?,?)",
        id,
        row.tenant_id,
        row.site_id,
        row.object_key,
        row.hash,
        row.bytes,
        row.mime,
        d.width,
        d.height,
      );
      this.#run("UPDATE uploads SET state='committed' WHERE id=?", id);
      return this.#asset(this.#one("SELECT * FROM assets WHERE id=?", id)!);
    });
  }
  async abortUpload(actor: Principal, id: string) {
    this.#tx(() => {
      const u = this.#one("SELECT * FROM uploads WHERE id=?", id);
      if (!u) return fail("NOT_FOUND", "Resource not found.");
      this.#site(actor, String(u.site_id), true);
      if (u.state === "committed")
        fail("CONFLICT", "Committed originals cannot be aborted.");
      this.#run("UPDATE uploads SET state='aborted' WHERE id=?", id);
    });
  }
  async asset(actor: Principal, siteId: string, id: string) {
    this.#site(actor, siteId);
    const row = this.#one(
      "SELECT * FROM assets WHERE site_id=? AND id=?",
      siteId,
      id,
    );
    if (!row) return fail("NOT_FOUND", "Resource not found.");
    return this.#asset(row);
  }
  #domain(row: Row): Domain {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      siteId: String(row.site_id),
      hostname: String(row.hostname),
      challenge: String(row.challenge),
      state: row.state as Domain["state"],
      expiresAt: row.expires_at === null ? null : Number(row.expires_at),
    };
  }
  #verified(id: string, siteId: string) {
    const d = this.#one(
      "SELECT * FROM domains WHERE id=? AND site_id=?",
      id,
      siteId,
    );
    if (!d || d.state !== "verified" || Number(d.expires_at) <= this.now())
      return fail("UNVERIFIED", "Domain is not currently verified.");
    return this.#domain(d);
  }
  async addDomain(actor: Principal, siteId: string, hostname: string) {
    hostname = normalizeHostname(hostname);
    return this.#tx(() => {
      const s = this.#site(actor, siteId, false, true);
      if (this.#one("SELECT id FROM domains WHERE hostname=?", hostname))
        fail("CONFLICT", "Hostname is already reserved.");
      const id = randomUUID();
      this.#run(
        "INSERT INTO domains VALUES(?,?,?,?,?,'pending',NULL,NULL)",
        id,
        s.tenant_id,
        siteId,
        hostname,
        randomUUID(),
      );
      return this.#domain(this.#one("SELECT * FROM domains WHERE id=?", id)!);
    });
  }
  async domain(actor: Principal, id: string) {
    const d = this.#one("SELECT * FROM domains WHERE id=?", id);
    if (!d) return fail("NOT_FOUND", "Resource not found.");
    this.#site(actor, String(d.site_id), false, true);
    return this.#domain(d);
  }
  async recordVerification(
    actor: Principal,
    id: string,
    challenge: string,
    evidence: string,
    expiresAt: number,
  ) {
    return this.#tx(() => {
      const d = this.#one("SELECT * FROM domains WHERE id=?", id);
      if (!d) return fail("NOT_FOUND", "Resource not found.");
      this.#site(actor, String(d.site_id), false, true);
      if (d.challenge !== challenge || d.state === "revoked")
        fail("CONFLICT", "Domain challenge changed.");
      if (
        !evidence ||
        evidence.length > 200 ||
        !Number.isSafeInteger(expiresAt) ||
        expiresAt <= this.now() ||
        expiresAt > this.now() + 86400000
      )
        fail("INVALID", "Invalid verification evidence or validity period.");
      this.#run(
        "UPDATE domains SET state='verified', evidence=?,expires_at=? WHERE id=?",
        evidence,
        expiresAt,
        id,
      );
      return this.#domain(this.#one("SELECT * FROM domains WHERE id=?", id)!);
    });
  }
  async revokeDomain(actor: Principal, id: string) {
    this.#tx(() => {
      const d = this.#one("SELECT * FROM domains WHERE id=?", id);
      if (!d) return fail("NOT_FOUND", "Resource not found.");
      this.#site(actor, String(d.site_id), false, true);
      this.#run(
        "UPDATE domains SET state='revoked',challenge=?,expires_at=NULL WHERE id=?",
        randomUUID(),
        id,
      );
    });
  }
  #head(siteId: string): Head {
    const h = this.#one(
      "SELECT * FROM publication_heads WHERE site_id=?",
      siteId,
    )!;
    return {
      generation: Number(h.generation),
      releaseId: h.release_id as string | null,
      jobId: h.job_id as string | null,
      domainId: h.domain_id as string | null,
    };
  }
  async head(actor: Principal, siteId: string) {
    this.#site(actor, siteId);
    return this.#head(siteId);
  }
  #job(row: Row): PublicationJob {
    const r = this.#one("SELECT * FROM releases WHERE id=?", row.release_id)!;
    const release: Release = {
      id: String(r.id),
      tenantId: String(r.tenant_id),
      siteId: String(r.site_id),
      sourceVersion: Number(r.source_version),
      document: JSON.parse(String(r.document)),
      hash: String(r.hash),
      assets: JSON.parse(String(r.manifest)),
    };
    return {
      id: String(row.id),
      release,
      domainId: String(row.domain_id),
      expectedGeneration: Number(row.expected_generation),
      state: row.state as PublicationJob["state"],
      artifact: row.artifact ? JSON.parse(String(row.artifact)) : null,
    };
  }
  async job(actor: Principal, id: string) {
    const j = this.#one("SELECT * FROM publication_jobs WHERE id=?", id);
    if (!j) return fail("NOT_FOUND", "Resource not found.");
    this.#site(actor, String(j.site_id), false, true);
    return this.#job(j);
  }
  async reservePublication(actor: Principal, input: PublicationRequest) {
    input = parse(publishSchema, input);
    return this.#tx(() => {
      const s = this.#site(actor, input.siteId, false, true),
        requestHash = hash(
          JSON.stringify({
            ...input,
            approvedAssetIds: [...input.approvedAssetIds].sort(),
          }),
        );
      const prior = this.#one(
        "SELECT * FROM publication_jobs WHERE tenant_id=? AND site_id=? AND idempotency_key=?",
        s.tenant_id,
        input.siteId,
        input.idempotencyKey,
      );
      if (prior) {
        if (prior.request_hash !== requestHash)
          fail(
            "CONFLICT",
            "Idempotency key was already used for another request.",
          );
        return this.#job(prior);
      }
      const domain = this.#verified(input.domainId, input.siteId),
        draft = this.#draft(input.siteId),
        head = this.#head(input.siteId);
      if (
        draft.version !== input.expectedDraftVersion ||
        head.generation !== input.expectedGeneration
      )
        fail("CONFLICT", "Draft or published generation changed.");
      publicationDocument(draft.document, domain.hostname);
      const assets = this.#assets(input.siteId, draft.document);
      if (
        JSON.stringify(assets.map((a) => a.id).sort()) !==
        JSON.stringify([...input.approvedAssetIds].sort())
      )
        fail(
          "INVALID",
          "Explicit approved asset set must match the frozen draft.",
        );
      if (assets.reduce((n, a) => n + a.bytes, 0) > 60 * 1024 * 1024)
        fail("MEDIA", "Release media exceeds 60 MB.");
      const releaseId = randomUUID(),
        id = randomUUID();
      this.#run(
        "INSERT INTO releases VALUES(?,?,?,?,?,?,?,?)",
        releaseId,
        s.tenant_id,
        input.siteId,
        draft.version,
        JSON.stringify(draft.document),
        draft.hash,
        JSON.stringify(assets),
        actor.subject,
      );
      for (const a of assets)
        this.#run(
          "INSERT INTO release_assets VALUES(?,?,?,?)",
          releaseId,
          s.tenant_id,
          input.siteId,
          a.id,
        );
      this.#run(
        "INSERT INTO publication_jobs VALUES(?,?,?,?,?,?,?,?,?,'pending',NULL,NULL)",
        id,
        s.tenant_id,
        input.siteId,
        releaseId,
        input.domainId,
        actor.subject,
        input.idempotencyKey,
        requestHash,
        input.expectedGeneration,
      );
      return this.#job(
        this.#one("SELECT * FROM publication_jobs WHERE id=?", id)!,
      );
    });
  }
  #activate(
    actor: Principal,
    job: PublicationJob,
    expected: number,
    action: "activate" | "rollback",
  ) {
    const h = this.#head(job.release.siteId);
    if (h.generation !== expected)
      fail("CONFLICT", "Published generation changed.");
    this.#verified(job.domainId, job.release.siteId);
    const generation = expected + 1;
    this.#run(
      "UPDATE publication_heads SET generation=?,release_id=?,job_id=?,domain_id=? WHERE site_id=?",
      generation,
      job.release.id,
      job.id,
      job.domainId,
      job.release.siteId,
    );
    this.#run(
      "INSERT INTO publication_events VALUES(?,?,?,?,?,?,?,?,?)",
      randomUUID(),
      job.release.tenantId,
      job.release.siteId,
      actor.subject,
      action,
      h.jobId,
      job.id,
      generation,
      this.now(),
    );
    return this.#head(job.release.siteId);
  }
  async commitPublication(actor: Principal, id: string, artifact: Artifact) {
    assertKey(artifact.key);
    if (
      !/^[a-f0-9]{64}$/.test(artifact.hash) ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes <= 0
    )
      fail("INVALID", "Invalid artifact receipt.");
    return this.#tx(() => {
      const row = this.#one("SELECT * FROM publication_jobs WHERE id=?", id);
      if (!row) return fail("NOT_FOUND", "Resource not found.");
      this.#site(actor, String(row.site_id), false, true);
      const job = this.#job(row);
      if (job.state !== "pending")
        fail("CONFLICT", "Publication job is not pending.");
      if (this.#draft(job.release.siteId).version !== job.release.sourceVersion)
        fail("CONFLICT", "Draft changed while preparing the publication.");
      this.#run(
        "UPDATE publication_jobs SET state='committed',artifact=? WHERE id=?",
        JSON.stringify(artifact),
        id,
      );
      return this.#activate(actor, job, job.expectedGeneration, "activate");
    });
  }
  async failPublication(actor: Principal, id: string, reason: string) {
    this.#tx(() => {
      const row = this.#one("SELECT * FROM publication_jobs WHERE id=?", id);
      if (!row) return fail("NOT_FOUND", "Resource not found.");
      this.#site(actor, String(row.site_id), false, true);
      this.#run(
        "UPDATE publication_jobs SET state='failed',failure=? WHERE id=? AND state='pending'",
        reason.slice(0, 200),
        id,
      );
    });
  }
  async rollback(
    actor: Principal,
    siteId: string,
    targetJobId: string,
    expected: number,
  ) {
    return this.#tx(() => {
      this.#site(actor, siteId, false, true);
      const row = this.#one(
        "SELECT * FROM publication_jobs WHERE id=? AND site_id=? AND state='committed'",
        targetJobId,
        siteId,
      );
      if (!row) return fail("NOT_FOUND", "Committed publication not found.");
      return this.#activate(actor, this.#job(row), expected, "rollback");
    });
  }
  async resolvePublished(hostname: string) {
    const d = this.#one(
      "SELECT * FROM domains WHERE hostname=? AND state='verified'",
      hostname,
    );
    if (!d || Number(d.expires_at) <= this.now())
      return fail("NOT_FOUND", "No active publication.");
    const head = this.#head(String(d.site_id));
    if (head.domainId !== d.id || !head.jobId)
      return fail("NOT_FOUND", "No active publication.");
    const row = this.#one(
      "SELECT * FROM publication_jobs WHERE id=? AND state='committed'",
      head.jobId,
    );
    if (!row) return fail("NOT_FOUND", "No active publication.");
    return this.#job(row);
  }
}
