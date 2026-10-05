# Independent viewport arrangements — 0.14.0

This design is recorded before implementing document v9. It replaces shared section membership with two explicit ordered section collections, referencing one shared collection of authored works.

## Invariants

1. `Page.blocks` owns each authored work exactly once. Work IDs, text, media references, captions, crop, fit and focal point are preserved during migration and arrangement operations.
2. An arranged page stores `composition.desktop` and `composition.mobile`. Each is an ordered array of groups. Each group owns its ID, ordered work references, layout, width, alignment, vertical alignment, gap and preceding space. There is no mobile-order alias or embedded second-device geometry.
3. Each viewport partitions the page's complete work IDs exactly once. Missing references, repeated occurrences, duplicate group IDs in a viewport and invalid device geometry are errors. Aliased duplicate occurrences are unsupported. Explicit “duplicate as new works” creates new shared content identities and places them in both viewports; it never aliases an occurrence.
4. Desktop section order remains the canonical `Page.blocks` ordering for compatibility with original direction renderers. This ordering contains references to the same authored records; desktop moves never alter their fields. Phone arrangement operations preserve the block array and the complete desktop arrangement. Desktop arrangement operations preserve the complete phone arrangement.
5. Grouping/separation preserves the chosen viewport's current reading order. Explicit movement changes only that viewport's order. A gap in the chosen order is an inline refusal; another viewport's different grouping/order cannot veto the operation.
6. Editing a work's text/media/caption/crop edits its shared record. Removing content removes its references from both layouts, retaining surviving groups. Adding new content adds deterministic single-work groups to both; it does not restructure existing groups. Deleting or duplicating shared works must state its cross-device scope.
7. v1–v8 documents migrate through their existing validated defaults to v9. A v8 desktop section becomes the same desktop geometry and membership. Phone sections follow the old `mobileOrder` (or old section order), expand each old `reverse` into explicit work order, and copy phone width/layout/gap/space plus the previously shared alignment fields. Phone section IDs receive a deterministic prefix. Null/disabled original layouts retain their behavior. Invalid old order/references are rejected before conversion, never silently repaired.
8. Migration is pure on read. The first subsequent save atomically retains the exact original stored record as `pre-independent-viewports`. Existing recovery records and immutable releases are not rewritten. Their read/export paths migrate into memory through the same schema.
9. Named studies snapshot both layouts, never authored text/media. Applying a study reconciles surviving works with current content and appends new works safely to both layouts, retains the displaced arrangement, and remains one Undo. A/B comparison stays read-only except for explicit Apply.
10. Backup v9 accepts historical envelopes v1–v8. Editor storage, recovery, local backend validation, public HTML/ZIP export and the standalone runtime use the same validated representation. No schema-specific shadow renderer or fallback grouping guesses.

## Planned acceptance

Migrate historical layouts with varied group sizes, mobile permutations and reversals, and compare old/new render geometry and complete work orders. Round-trip both layouts through schema, backup, recovery, studies and public export; reject malformed coverage. In the real editor, retain desktop A+B while phone separates and orders A,C,B, edit B on desktop and see it on phone, Undo a phone regroup without changing desktop, then keep/apply a study, reload and render actual exports. All browser fixtures use unique synthetic workspaces.

Per-block typography and spatial placement are outside this milestone. The focused canvas and 44px control rails remain.

## Implemented and verified

The invariants above were recorded before implementation. The current document and editable backup version is 9. `compositionOrder.ts` owns viewport selection and replacement; the editor, grouping/drop planner, studies and renderer use it. Legacy embedded mobile geometry/order is converted once into explicit phone groups. Existing source records and immutable revisions remain untouched on read. Save, backup replacement and recovery restore preserve the exact displaced pre-v9 record atomically. Backend input validation checks the historical input shape before migration, so unknown fields do not get mistaken for renamed migration fields.

The existing Story import adapter received only the required composition shape conversion. No Ritual project, native workflow, external infrastructure, remote service, domain or deployment was changed.

### Acceptance evidence

- **225 tests / 14 files**, including 34 SQLite backend cases. Migration tests cover permutations, reversal, geometry, disabled layouts, studies, malformed references, duplicate occurrences, exact pre-migration recovery, stale writers, historical immutable release reads/exports, SQLite reopen/history restore, content addition/deletion and explicit new-work duplication. [Test output](evidence/independent-viewports/tests.txt).
- **Types, lint and production build passed.** [Build](evidence/independent-viewports/build.txt), [lint](evidence/independent-viewports/lint.txt). Existing Vite chunk warning remains: editor 626.32 kB minified, portable runtime 391.35 kB. Node SQLite experimental and Zod annotation warnings are informational.
- **Actual editor, isolated Chromium 145.0.7632.6:** v8 load remained a v8 stored record until the first edit; exact recovery retained. Desktop A+B remained grouped while phone separated and read A,C,B. B was edited on desktop and appeared on phone. A+C were grouped by emulated touch drag across desktop boundaries, then one Undo restored phone only. Phone resizing, pointer Escape after toolbar Undo, reload during a lifted keyboard move, named study save/A-B/apply and reload passed. [Results](evidence/independent-viewports/browser-results.json).
- **Migration render equality:** archived v0.13.0 source temporarily served on 5193 versus current v9; synthetic input used weighted columns, reading widths, alignments, varied spacing, a mobile section permutation and reversed phone groups. All **40 screenshots were pixel-identical**: ten directions × 390/1440px × enabled/disabled arrangements. Geometry and complete work order matched too. [Hashes/results](evidence/independent-viewports/migration/browser-results.json), [v8 phone](evidence/independent-viewports/migration/v8-390.png), [v9 phone](evidence/independent-viewports/migration/v9-390.png).
- **Actual portable exports:** standalone HTML and extracted ZIP both rendered at 390 and 1440, preserving exact groups/order/width/gap/space, shared text, decoded image media and 23%/72% focal point. Private studies/editor controls were absent. [Standalone HTML](evidence/independent-viewports/independent-artist.html), [ZIP](evidence/independent-viewports/independent-artist.zip), [desktop screenshot](evidence/independent-viewports/standalone.html-1440.png), [phone screenshot](evidence/independent-viewports/standalone.html-390.png).
- **Focused-canvas regression:** 390/768/1440 layouts, physical 44px controls above artwork, Fit/100%, hidden-sidebar mutation attempts, Undo/Redo during comparison, late upload/restore callbacks, linked scroll, phone A/B toggle, current-content Apply, displaced study, exact Undo and reload. [Results](evidence/independent-viewports/focus-regression/browser-results.json).

During acceptance, Escape after toolbar Undo exposed an iframe focus ownership issue. Pointer gestures now explicitly focus their own canvas control; Escape reaches the owning gesture rather than clearing work selection in the parent window. The exact interrupted flow passed after the fix.

### Run and review

The canonical project remains `latent-studio-workbench`; run `npm run dev` and open **http://127.0.0.1:5181/**. Existing main drafts were not seeded or replaced. All browser runs use new UUID workspace URLs in isolated profiles and refuse an existing saved draft. The screenshots and HTML/ZIP use original synthetic geometry, not artist artwork.

```sh
npm run build
npm run lint
npm test
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers node scripts/verify-independent-viewports-browser.mjs
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers node scripts/verify-canvas-focus-browser.mjs
```

The earlier `verify-canvas-browser`, `verify-grouping-browser` and `verify-work-drag-browser` entry points now invoke the consolidated v9 acceptance script; their v8 implementations remain in `docs/recovery/pre-independent-viewports-v0.13.0.tar.gz`. This is not three independent new passes. The migration comparison script additionally requires the archived source on loopback 5193: extract its `src` into an OS temporary directory, copy the current Vite config/index/package files, link the installed dependencies and synthetic public assets, then run Vite there. The comparison does not seed user profiles or modify the archive.

Safari/WebKit and physical-device behavior were not tested because no supported workflow was available. Touch evidence is Chromium emulation. Repeated occurrences of the same work within one viewport are intentionally unsupported and rejected; explicit duplication creates fresh shared work IDs. Per-block typography, spatial placement/overlap and deployment remain outside this milestone. Undo remains session-local. Native browser download receipt was not exercised; actual generated file contents and rendered exports were verified.
