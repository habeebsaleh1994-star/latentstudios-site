# Local backend foundation — 0.7.0

Implemented in `backend/`; nothing in this directory is imported by the website editor. There is no HTTP listener, mock sign-in UI, token endpoint or browser-store migration. Use `npm run backend:demo` for an actual local integration scenario with synthetic principals and a simulated domain verifier. The authoritative editor remains on 5181 with its existing IndexedDB saves.

## Boundaries and concrete ownership

`contracts.ts` defines provider-neutral principals, authentication, repository operations, private objects, media inspection, domain verification and publication preparation/verification. Authentication is a **required trusted upstream boundary**, not an implemented service. `Principal.subject` must come from a verified session, never a submitted owner/tenant header or body field. The CLI/tests construct fixture principals directly and never export that mechanism into a network app.

`SqliteRepository` implements operation-level atomic repository methods. Each mutation checks membership inside its transaction. Owners can manage domains and activate/rollback releases; editors may edit drafts and upload; viewers may read. Asset references are restricted to the owning site, including within one tenant. Unauthorized or missing resources use the same not-found result where applicable. No ownership can be established by guessing a hash or asset ID.

Three ordered SQLite migrations create:

| Area | Tables and invariants |
|---|---|
| Identity / ownership | principals, tenants with an owner, memberships with owner/editor/viewer, tenant-scoped sites |
| Work in progress | revision-checked drafts plus immutable draft_history; restoring appends a new revision |
| Media | staged/committed/aborted uploads, immutable assets; exact upload ownership/hash/type/size must match before admission |
| Public-address intent | unique exact hostname mappings, random challenge, pending/verified/revoked state, evidence and expiry |
| Editions | immutable releases with frozen documents/manifests and composite tenant/site asset foreign keys |
| Publication | pending/committed/failed jobs with request-bound idempotency keys, generation-checked heads, append-only activation/rollback events |

Migrations are transactional and checksum tracked; altered checksums and unknown newer migrations are refused. No down migration/deletion policy is supplied. `BEGIN IMMEDIATE` and compare-and-swap checks serialize activation; this SQL adapter is SQLite-specific even though the domain contracts are provider neutral.

## Upload and document admission

A new site starts without media. Upload bytes enter through a strict metadata allowlist: safe basename, declared JPEG/PNG MIME, matching extension, byte limit and SHA-256. No caller-chosen storage key, source filesystem path, remote URL or hidden fields are accepted. The service generates scoped UUID keys, validates bytes and actually decodes media before committing the asset. The local ImageIO adapter applies a header/pixel boundary before its timed decode. Arbitrary SVG, HTML, remote fetches, archives and unsupported codecs are refused.

Private file storage uses a service-owned root, canonicalizes OS path aliases, accepts only generated three-UUID keys mapped to flat filenames, creates files exclusively, refuses symlink files, fsyncs writes and verifies original bytes on read. No globally deduplicated object can bridge tenants. These local checks do not replace a remote bucket policy.

Documents are bounded to 2MB, validated with the current v6 editor model, with known v5 admission/migration, checked for safe route/block IDs, unknown/private fields, valid metadata and owned media of the correct kind. Existing local backups must first be deliberately migrated and reviewed in the editor; the backend does not parse ZIPs or infer references from user file paths. The editor's original browser stores remain separate.

## Publication and recovery contract

1. Reserve a request only for the owner, exact draft revision, current publication generation, verified/unexpired domain and exact approved asset set. Store a frozen release and pending job in one transaction. An idempotency key is bound to all request inputs.
2. Read and hash every approved original. Prepare an immutable private artifact in separate storage. The current `ManifestPublisher` writes `site.json` and separate media objects, then a manifest. It is a real data publication artifact, not a rendered or publicly hosted website.
3. Verify the artifact's job/release/tenant binding, exact file set, document hash, media hashes, lengths and actual bytes. Recheck the actor's role, domain status, approved draft version and publication generation at activation.
4. Commit the job receipt, head pointer and audit event together. A competing publish, changed draft, revoked/expired domain or injected transaction failure leaves the old head intact. A failed attempt's artifact is discarded best-effort; its frozen release/job record remains inspectable.
5. Repeating the same committed request returns its original receipt. Concurrent retries may prepare two private artifacts; only the committed one is retained. Recovery resumes a pending job from its frozen document after a database reopen. Failed jobs are terminal; submit a new key after repairing the cause.
6. Rollback verifies a previously committed artifact, then advances the current generation and records the event. It never mutates an old release or the working draft. A stale rollback cannot undo a newer publish.

The public-read contract resolves an exact currently verified domain and current head, then allows only paths explicitly present in that artifact. Original-store keys, raw manifest keys and arbitrary paths are not published routes. The test harness calls this in-process; no HTTP or public file endpoint exists.

A process crash between file creation and database activation can leave an unreferenced private object. There is no automatic GC. Production needs durable job leases, reconciliation, explicit retention, cleanup receipts and verified backup/restore. The bounded tests cover thrown failures and reopen/resume, not power loss or multi-region consistency.

## Exact provider adapter gaps

| Adapter | Still required before a real beta |
|---|---|
| Authentication | Implement verified issuer/audience/expiry/session validation and subject mapping. Decide cookie/CSRF/session recovery policy, roles/invitations, SMTP sender and abuse controls. Remove any possibility of caller-supplied principals at the transport boundary. |
| Supabase / Postgres | Port SQLite DDL/triggers to Postgres types and transactions. Map subjects to authenticated users, enable and test RLS for every tenant table/storage path, use constrained functions or transactions for atomic publication, define service-role privileges and test using real anonymous/authenticated roles. Keep production DB ownership from bypassing intended policies. These RLS policies are not implemented here. |
| Private object storage / R2 | Implement bounded streaming uploads, conditional immutable puts, verified hashes and MIME inspection, private access/signed-URL policy, multipart abort, scoped credentials, staged-upload expiry and reconciliation. Do not treat an ETag as this application's SHA-256. Decide originals versus public derivatives, backups, versioning and deletion. No R2 bucket/client is configured. |
| Render / delivery | Bind the existing artist renderer and responsive image recipe to a deterministic publication compiler, produce a sealed website artifact and deploy it. Implement atomic routing, invalidation, rollback and revocation for the chosen host. This milestone publishes a private data manifest only. |
| Domains / certificates | Real provider/DNS ownership proof, challenge lifecycle, exact-host routing, certificate readiness/renewal, revalidation and safe release/reassignment. The verifier fixture makes no DNS calls and proves no external ownership. |
| Operations | Owner/admin access, region/residency, database and object recovery objectives, independent backup/restore tests, queues/timeouts, quotas/rate limits, telemetry and spend limits. |
| Media processing | Portable sandboxed JPEG/PNG/WebP/animation/video inspection; orientation/profile handling, reproducible derivatives, resource limits, malware policy if needed, captions and any adaptive video decision. Browser media support is broader than this deliberately narrow server inspector. |

Current primary-source references for adapter work: [Node SQLite](https://nodejs.org/docs/latest-v25.x/api/sqlite.html), [Postgres row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control), [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/). PostgreSQL table owners normally bypass RLS, and Supabase service keys can bypass storage RLS: real adapter tests must therefore use the actual intended roles, not just privileged test clients.

## Next safe work

Either build the six remaining visual directions with authored examples and desktop/mobile review, or connect this service to a **local-only deterministic renderer/adapter harness** before adding any network authentication or deployment. The latter would compile the existing renderer, verify its exact output against the frozen release, test restore/upload failure reconciliation and keep the current editor untouched until an explicit reviewed transfer exists. No mock cloud dashboard is needed.

Real provider integration still requires the owner account, existing services, monthly beta ceiling/usage, data region, authentication/collaboration policy, intended domain/DNS owner, release exposure and recovery/retention decisions in [PRODUCTION-DECISIONS.md](PRODUCTION-DECISIONS.md). No services or money have been committed.
