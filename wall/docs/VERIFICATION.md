## Canvas focus verification — 2026-10-05

Version 0.13.0: 200 tests / 13 files, lint, client/backend types and production build pass. The suspected comparison mutation was freshly reproduced against v0.12 in a unique synthetic database and is now blocked at the mutation layer. Fresh browser checks cover protected matched-scale A/B comparison, phone toggling, real Undo/Redo history, upload/restore callbacks, edit/apply/Undo/reload, control rails and measured canvas gains. All three earlier gesture/grouping/export suites pass again. [Exact before/after evidence and limitations](CANVAS-FOCUS.md).

## Direct drag verification — 2026-10-05

Version 0.12.0: 196 tests / 12 files, lint, client/backend types and production build pass. Actual isolated Chromium acceptance repeats image/text selection, direct grouping, group movement, resize, caption editing, phone-only adjustment and exact Undo using keyboard, mouse and emulated touch. Earlier canvas and grouping/export suites pass again. Four responsive sizes retain 44px work and section controls without horizontal overflow. [Evidence, scope and candid limits](DIRECT-DRAG.md). Shared desktop/phone group boundaries remain; no Safari or physical-device pass is claimed.

## Direct grouping verification — 2026-10-05

Version 0.11.0: 189 tests / 11 files, lint, client/backend types and production build pass. Direct selection/regrouping, responsive alternatives, actual phone/tablet touch, mobile-order conflict handling and standalone export parity were verified in isolated Chromium contexts. The previous canvas gesture suite also passes again. [Exact evidence and limits](DIRECT-GROUPING.md).

## Canvas studies verification — 2026-10-05

Version 0.10.0: 174 tests / 10 files, lint, client/backend types and production build pass. The isolated Chromium pointer/keyboard/touch run and reviewed desktop/mobile screenshots are recorded in [CANVAS-STUDIES.md](CANVAS-STUDIES.md). This supplements the earlier milestone evidence below; it does not claim a new Safari or physical-device pass.

## Dependency maintenance · 2026-10-05

Vitest and its mocker are now **4.1.11**, fixing GHSA-82fw-gwwq-j7x9. Fresh audit reports **0 vulnerabilities**. All 160 tests, lint, client/backend types, production build and the local-browser smoke check pass. [Exact package changes, evidence and warnings](DEPENDENCY-MAINTENANCE.md). Historical advisory entries below describe the pre-upgrade state.

## 0.9.0 verification recovery · 2026-10-05

Live browser import, confirmation, separate persistence, edits, backup restore, local release and desktop/mobile rendering passed. The bridge reader isolation warning is fixed; 28 focused Swift tests, both native builds, 160 web tests, lint and build pass. Native interactive verification remains blocked by the locked Mac. [Current evidence and limits](RITUAL-BRIDGE.md). The sections below preserve earlier milestones and their then-current limits.

# Latest increment — Ritual bridge 0.9.0

The actual native adapter/exporter and reviewed web importer are implemented. [Bridge verification, artifacts and remaining UI blocker](RITUAL-BRIDGE.md). Document/backup is now v7. The browser evidence below belongs to the completed **0.8.0** ten-direction milestone; it must not be treated as a new bridge UI run.

---

# Ten directions — verified local increment

**Application 0.8.0 · document/backup v6 · 2026-10-05 UTC.** The canonical workspace remains `latent-studio-workbench` and the editor remains **http://127.0.0.1:5181/**. Review the [ten isolated studios](http://127.0.0.1:5181/?examples=1). This completes ten local starting directions, not production hosting or a launch-readiness claim.

## Implemented

| Direction | Fictional studio | Home and inner-page structure |
|---|---|---|
| Folio | Mara Ellis | Editorial unfolding, image/text sequence |
| Gallery | Sora Vale | Exhibition and room viewer |
| Cinema | Ivo Sen | Programme and screening viewer |
| Archive | Noor Rahal | Searchable index and reading pages |
| Gazette | Elena Voss | Issue masthead, lead feature, contents, split editorial pages |
| Horizon | Kai Rowan | Desktop filmstrip with buttons/arrow keys; complete vertical mobile reading |
| Poster | Ada Morel | Typographic billboards, large project headings and full media |
| Atelier | Common Form | Practice-led index, split project case studies and process writing |
| Journal | Lina Moss | Marginal notes, ordered entries and intimate essay measures |
| Montage | Rémy Sol | Asymmetric non-overlapping image/text placement in authored order |

The original four renderer files and their two core stylesheets are byte-identical to the pre-increment source snapshot. Six new studios contain original fictional writing and existing licensed/original demo media. No user's artwork or competitor assets were added. The six new studios initially use their native layouts; optional shared composition works in all ten.

Direct text/media editing, page/project order, navigation, explicit image crop/focal settings, per-direction identity, desktop/mobile composition, queued local saves, recovery, immutable local releases, editable backups and both portable website formats remain shared contracts. A style switch changes presentation, never the source page/block arrays.

Document v6 adds six independent appearance records while preserving the previous four. Versions 1–5 migrate in memory; reading does not overwrite the saved original. The first changed save preserves its exact prior record as **Before ten directions**. Existing release envelopes remain version 1; their embedded document migrates on read. Backup import accepts versions 1–6. The separate SQLite backend admits v5/v6 with the same field/ownership checks.

## Actual browser checks

Only isolated fictional studios were edited. Main drafts, the existing Sora/Mara review work, the earlier projects on 5178/5179 and the user's Safari work were not reset.

- **136 independently served export route checks:** all 48 ZIP pages at **1440×1000** and **390×844**, plus home and first work from all ten embedded HTML files at both sizes. All exact titles matched, with no document-width overflow and all 104 visible-image observations loaded. Below-fold lazy images were not treated as failures merely for being unloaded.
- **74 route checks compared exact rendered block-ID sets** in new/native and shared compositions. Twenty-two original-direction native routes do not expose those markers; their render/title/image checks passed, but marker-level coverage is not claimed for them. Automated renderer tests cover their composed content retention.
- Forty desktop/mobile screenshots cover the home and first work of all ten ZIP exports. Visual review included magazine hierarchy, filmstrip, Poster word wrapping, studio split layout, essay measure and asymmetric collection. [Raw route evidence](evidence/ten-directions/browser-render-checks.json) · [asserted results](evidence/ten-directions/verified-results.json).
- Actual direct title edits, Escape, Undo/Redo, immediate panel navigation and reload passed in all six new studios. **A real defect was fixed:** CSS uppercase display styling entered `innerText` and could alter saved Poster text. Selected editing now removes display casing; the repeated exact-case round trip passed. Original titles were restored.
- A shared three-work composition was switched through all ten directions at both canvas sizes. Desktop remained `a1,a2,a3`; independent mobile remained `a2,a1,a3`. A custom Poster canvas survived the full style cycle and was then restored. [Actual switching evidence](evidence/ten-directions/editor-switch-checks.json).
- A real **Ten directions · Poster review** release was created after passing readiness checks. Later draft title changes did not alter its frozen `Common ground` page. Its v6 editable backup was copied through the UI, restored, reloaded and verified with the same media and mobile order. The outgoing draft remained in recovery. The review release remains in Ada's isolated studio. [Backup](evidence/ten-directions/poster-editable-backup-v6.json) · [flow observations](evidence/ten-directions/editor-flow-evidence.json).
- Horizon's next button and right-arrow key advanced its actual rail; at 390px its four works formed a complete vertical flow. Its independently exported native video played: duration 2 seconds, readyState 4, paused false, no media error. No autoplay was added.
- All six exported mobile menus opened, followed About and closed after navigation. [Navigation observations](evidence/ten-directions/mobile-navigation-checks.json).
- The final built application was separately served at temporary loopback 5182. Its ten-studio selection and all six new site directions rendered, with no captured warnings/errors. That temporary server was stopped after review. [Production smoke evidence](evidence/ten-directions/production-smoke.json).

## Export evidence

The dev-only `tests/browser/directions.html` harness creates synthetic frozen revisions using the application's **real** collect-media, prepare-display, `portableHTML`, `portablePackage` and ZIP functions. It never opens or modifies artist drafts. Browser-generated bytes were read from its explicit visible textarea, saved locally, CRC checked, independently unzipped and rendered from a separate loopback server. No external host was used. Native browser download receipt remains unverified; generated payload validity is verified.

Each evidence archive contains `single.html`, the actual `website.zip`, and a page/media receipt. Extracted evidence is also retained:

| Direction | Embedded HTML | Responsive folder ZIP |
|---|---|---|
| Folio | [HTML](evidence/ten-directions/mara/single.html) | [ZIP](evidence/ten-directions/mara/website.zip) |
| Gallery | [HTML](evidence/ten-directions/sora/single.html) | [ZIP](evidence/ten-directions/sora/website.zip) |
| Cinema | [HTML](evidence/ten-directions/ivo/single.html) | [ZIP](evidence/ten-directions/ivo/website.zip) |
| Archive | [HTML](evidence/ten-directions/noor/single.html) | [ZIP](evidence/ten-directions/noor/website.zip) |
| Gazette | [HTML](evidence/ten-directions/elena/single.html) | [ZIP](evidence/ten-directions/elena/website.zip) |
| Horizon | [HTML](evidence/ten-directions/kai/single.html) | [ZIP](evidence/ten-directions/kai/website.zip) |
| Poster | [HTML](evidence/ten-directions/ada/single.html) | [ZIP](evidence/ten-directions/ada/website.zip) |
| Atelier | [HTML](evidence/ten-directions/common/single.html) | [ZIP](evidence/ten-directions/common/website.zip) |
| Journal | [HTML](evidence/ten-directions/lina/single.html) | [ZIP](evidence/ten-directions/lina/website.zip) |
| Montage | [HTML](evidence/ten-directions/remy/single.html) | [ZIP](evidence/ten-directions/remy/website.zip) |

All ten outer/inner archives passed CRC/path checks and every receipt file matched its byte count. [Archive checks](evidence/ten-directions/archive-checks.json) · [Generation/size receipts](evidence/ten-directions/export-generation.json). The export bytes preceded the final selected-edit casing guard; that guard is inactive in read-only exports and no direction output changed afterward.

## Automated checks and dependency decision

- **139 tests / eight files pass**, including 19 dedicated ten-direction checks and 32 real SQLite/filesystem backend tests. Coverage includes exact v5 migration retention, all ten appearance/backup round trips, all sample content through style changes/composed rendering, six native block sequences, old document admission and new-style database reopen.
- `npm run build` passes frontend TypeScript, backend TypeScript and production Vite build. `npm run lint` passes. Relevant formatting applied. [Test log](evidence/ten-directions/final-tests.log) · [Build log](evidence/ten-directions/build.log) · [Lint log](evidence/ten-directions/final-lint.log).
- Existing build advisories: 551.83KB main editor chunk, two upstream Zod annotation warnings and experimental Node SQLite. These do not establish production performance or portability.
- **Historical pre-upgrade Vitest finding — now fixed in 4.1.11.** Installed Vitest 3.2.7 and its mocker are covered by [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). The upstream advisory specifies fixes in 4.1.11/5 and says 3.x is unmaintained with no planned backport. This workbench uses `vitest run`; its Vite config does not register the vulnerable public mocker/interceptor plugins. No compatible small patch was available, so no major upgrade or unsupported override was forced into this style increment. [Retained registry audit](evidence/backend-dependency-audit.json).

## Limits and review links

Browser coverage is the Mac's in-app browser, not multiple engines or physical devices. No full accessibility audit, 200% zoom matrix, quota-exhaustion test, process-kill/power-loss test, visual-regression baseline or load test was performed. The reviewed samples are fictional design coverage, not artist research. Local data still needs external backups; session Undo ends at reload.

Production gaps remain: real authentication, remote API/RLS, provider storage/jobs, integration of the actual renderer with backend publication, hosting/SSL, live domain verification, subdomains, billing and operational recovery. The local publisher still prepares a private data/media manifest, not a hosted HTML website. Ritual import remains blocked on a supported structured Story/media export contract. No publishing, credentials, DNS changes, purchases, remote push or other Latent product changes occurred.

Review [Gazette desktop](evidence/ten-directions/gazette-home-desktop.jpg), [Poster mobile](evidence/ten-directions/poster-home-mobile.jpg), [Atelier case study](evidence/ten-directions/atelier-open-house-desktop.jpg), [Journal essay](evidence/ten-directions/journal-a-chair-mobile.jpg), [Montage collection](evidence/ten-directions/montage-loose-parts-desktop.jpg), and [restored editor](evidence/ten-directions/poster-restored-editor.jpg).

Source recovery: `docs/recovery/pre-ten-styles-source-v0.7.0.tar.gz` (source only; not a browser-data backup). [Backend verification](BACKEND-VERIFICATION.md) · [Architecture](ARCHITECTURE.md) · [Media provenance](MEDIA.md) · [Production decisions](PRODUCTION-DECISIONS.md) · [Ritual blocker](RITUAL-STORIES-IMPORT-PLAN.md).
