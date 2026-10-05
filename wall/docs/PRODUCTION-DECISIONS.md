# Production decisions and next bounded local increment

The current work is an offline-capable local editor and portable website renderer. No cloud service is provisioned, connected, billed or represented by a mocked working button. Product name remains temporary. The live manuscript and other Latent products are not default deployment targets.

## Proposed architecture, independent of provider

An authenticated control service owns tenant/site membership, mutable draft revision checks, immutable releases, asset ownership and a separately committed release pointer. A private original-media store preserves uploaded bytes and provenance. Rebuildable display variants are content addressed by original hash and processing recipe. A publication worker validates a frozen manifest, produces a read-only website, then atomically advances the published release only after all required media are available. A failed upload/build cannot expose a partial release.

Keep control and delivery separate: private originals and drafts are never public just because a derivative was published. Public access names an explicit release and its permitted derivative set. Cross-tenant asset IDs and hashes must not bypass authorization. Unpublish/revoke, retention and deletion need defined semantics; object backups and database recovery are separate deliverables. Film delivery needs an explicit later decision about file-size limits, captions and transcoding.

Adapters should preserve the existing draft/revision/media contracts. Candidate stacks discussed in the parent task include Supabase Auth/Postgres, R2 media storage, and either Cloudflare or Vercel delivery. These are candidates for evaluation, not selected dependencies or claims of current service pricing. No SDK, provider account or credentials have been added.

## Decisions still pending

| Decision | Required answer before provisioning |
|---|---|
| Ownership | Which Latent-owned organization/account owns hosting, database, storage, billing and recovery access? Who is the initial operator? |
| Existing services | Identify current providers and anything intentionally reusable; do not reuse Moment/Field infrastructure implicitly. |
| Region | Where may account data, originals, derivatives and backups reside? Identify any residency requirement before choosing regions. |
| Beta budget | Monthly ceiling, expected artist count, originals retained, upload limit, delivered image/video traffic, backup retention, and spend-alert/stop policy. Parent has already asked about hosting and budget; no duplicate question was sent. |
| Authentication | Single owner versus collaborator roles, sign-in method, email sender ownership, session/recovery policy. |
| Exposure | Exact approved release, review-link recipient/expiry/revocation rules, public subdomain convention, custom-domain/DNS owner. |
| Recovery | Recovery objectives, object and database backups, restore verification, retention/deletion and operational owner. |

Do not quote an unverified all-in monthly price. Estimate fixed platform charges plus database/storage/requests, image processing, video delivery, email, backups and overage at several usage levels after these inputs arrive. Domain purchase, DNS changes, publication and paid commitments remain separate authorized actions.

## Completed local increment — 0.7.0

Implemented a **local backend contract and tenant-isolation harness** in this workbench without choosing a provider or adding real accounts. Use synthetic tenants and a disposable SQLite database plus filesystem media adapter. Model memberships, site drafts with compare-and-swap revisions, immutable releases/manifests, asset ownership, rebuildable variants and staged-upload commit/rollback. Inject authenticated principals in tests only; do not present a test principal as real authentication.

Verify cross-tenant reads/writes are rejected, guessed asset IDs cannot escape ownership, stale draft/release writes fail, publication is atomic, and failed uploads leave no published dangling media. This is a CLI/test-only module with no HTTP route; the existing local editor remains unchanged. The contracts are now tested locally; real authentication, provider RLS, deployment and cloud operations remain unimplemented. See [backend evidence and adapter gaps](BACKEND-FOUNDATION.md).


## Next choice

The next safe scope is either six distinct additional styles, or a local renderer/publication adapter plus explicit transfer/reconciliation tests. Neither requires a provider decision. A networked beta does require the ownership, existing-provider, region, budget, authentication and exposure decisions above. The parent's hosting/budget question remains pending; it was not duplicated here.
