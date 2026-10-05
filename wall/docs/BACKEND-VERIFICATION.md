# Local backend verification — 2026-10-04 UTC

Application **0.7.0**, same canonical workbench and **5181** editor. Browser document/backup remains v5. No browser storage was migrated. All 56 actual frontend source files match the pre-backend source snapshot byte for byte (macOS archive metadata excluded); production asset names and sizes remain unchanged.

## Results

- **113 tests / seven files pass**: 82 prior checks plus **31 backend integration tests**.
- `npm run build` passes both frontend and backend TypeScript checks and the production build. `npm run lint` passes.
- `npm run backend:demo` passes eight real local scenario checks. [Machine-readable report](evidence/backend-demo-latest.json) records the private temporary directory and SQLite path. It is outside Vite's served tree. The report and test data are synthetic; no credentials or artist library were used.
- Actual browser reload at 5181 retained Mara's title and the existing **Field notes · web-image review** release. Captured browser warnings/errors: none. [Preserved editor screenshot](evidence/backend-editor-preserved.jpg).
- No backend/test identity strings, SQLite imports or migration code appeared in the built frontend. No backend HTTP server or new preview port exists. Existing 5178/5179 projects and Safari work were untouched.

## What the tests prove

The backend tests use real file-backed SQLite databases with foreign keys, WAL, FULL synchronous mode and transactional, checksum-tracked migrations. Two competing publication workers use separate database connections and an explicit preparation barrier; one activation wins by generation check. This is in-process concurrency with real database transactions, not a distributed-process or load test.

Coverage includes cross-tenant reads/writes/restore/grants, same-site asset ownership, viewer/editor/owner roles, append-only draft restore, stale writes, checksummed/unknown migration rejection, database foreign-key crossings, immutable release/history triggers, upload metadata/path/MIME/hash checks, symlink-file refusal, exact-byte JPEG and transparent-PNG decoding through macOS ImageIO, malformed/truncated images, staged-upload recovery, and rejection of a photo used as a film.

Publication checks cover unverified/expired/revoked domains, hostname collisions, exact explicit approved-media sets, missing originals, preserved prior releases, idempotency-key reuse, simultaneous retries without deleting the winning artifact, stale draft/domain status after preparation, incorrect but internally consistent artifact content, partial file-write cleanup, failure inside the activation transaction, recovery of a pending job after reopening the database, damaged-artifact rollback rejection, and generation-checked rollback that leaves the working draft intact.

The CLI scenario creates two fixture owners, uploads and actually decodes the licensed sea photograph, rejects a cross-tenant read and unverified domain, reopens SQLite with a pending job, completes activation, creates a second edition, rolls back to the first, and removes its own disposable original to prove that later publication fails while the already-prepared artifact still reads correctly. These are actual database/filesystem operations. Identity and DNS proof are simulated deliberately.

## Honest boundaries

- This is an in-process backend contract harness, **not real authentication, a network API or hosting**. Fixture principals are code-defined. The only domain verifier is a test/CLI fixture; it does not query or modify DNS. No UI service buttons were added.
- The local publisher prepares immutable private `site.json` + approved media artifacts and atomically activates their manifest in SQLite. It does not yet compile or deploy the website renderer. The existing browser-generated HTML/ZIP remains a separate working export flow.
- The local backend inspector deliberately accepts **JPEG and PNG only**, up to 30MB/file and 32MP, with 15-second decoding timeout. SVG, GIF, WebP and video fail closed until dedicated server inspectors exist. This does not remove their existing browser-editor support. No user media or browser draft is silently imported.
- Cleanup is best effort. A process crash can leave private staged/orphan objects. Pending uploads/jobs can be resumed or explicitly aborted; automatic retention/GC and orphan reconciliation are not implemented. Successful filesystem writes are fsynced; actual power-loss behavior was not tested.
- SQLite provides application-level authorization plus relational constraints, not Postgres RLS. A process with direct filesystem/database access is trusted. Real authentication, tenant RLS, least-privilege object credentials, jobs/leases, rate limits and provider rollback require their own adapters and acceptance tests.
- The Mac's Node 25.4 built-in SQLite emits its experimental warning. Native inspection uses `/usr/bin/sips`; Linux/production portability is not claimed.

Build advisories remain the 500KB editor chunk and two upstream Zod annotations. A fresh registry audit reports **two moderate development dependency entries** for the existing Vitest / @vitest/mocker advisory [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). Tests use `vitest run`, not a browser-mode mock server. No unrelated major test-framework upgrade was made; this advisory remains tracked in [the audit output](evidence/backend-dependency-audit.json). Only locked Node type definitions were added for backend type checking; no runtime service dependency was added.

## Review and recovery

Run `npm run backend:demo` from the workbench for a new disposable local scenario; the report is updated at `docs/evidence/backend-demo-latest.json`. Its raw files live in a private OS temporary directory and can be cleared by the OS. `npm test -- --reporter=dot` includes the backend suite; `npx vitest run tests/backend.test.ts` runs only its 31 cases.

Source recovery snapshot: `docs/recovery/pre-backend-source-v0.6.0.tar.gz`. It is a source snapshot, not a browser-data backup. Existing browser backups and prior evidence are retained.

[Backend contracts and provider gaps](BACKEND-FOUNDATION.md) · [Production decisions](PRODUCTION-DECISIONS.md) · [Previous media evidence](MEDIA-DELIVERY-VERIFICATION.md) · [Ritual source blocker](RITUAL-STORIES-IMPORT-PLAN.md).
