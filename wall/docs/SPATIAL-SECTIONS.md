# Optional spatial sections — 0.16.0

Spatial placement is implemented in the local workbench. Flow remains the default. In **Arrange**, choose **Place freely** on a content section, then drag a work or use **Move**, **Size** and **More**. Desktop and phone can independently use flow or placement. This milestone adds expressive placement to the existing editor; the relationship-based proposal workflow below is future work.

The product name remains temporary. Review at **http://127.0.0.1:5181/**. No hosting, publishing, accounts, domains, billing or production infrastructure changed.

## Architecture and invariants

1. Flow remains the default. An optional per-section `spatial` record owns enabled state, minimum height, frames keyed by existing work IDs and an explicit back-to-front layer permutation. Desktop and phone own separate section records. No content, asset, crop, focal point or typography field is changed by placement.
2. `section.blockIds` remains the accessible/DOM reading order. Moving or layering a work never changes it. Reading-order controls explicitly change only the chosen device's sequence; layers are a separate permutation. Each work occurs exactly once per viewport and once in its spatial section.
3. Frame x and width are percentages of the section's actual inner width. Frame y and minimum section height use CSS pixels. The first bounded version resizes width; height follows real image/film proportions, current crop choice, captions and live text/measure. It does not stretch media or introduce a fixed-height text box. Work stays inside horizontal edges; CSS intrinsic grid sizing expands the section to contain the lowest work. Longer writing can intentionally overlap another placed work but is never clipped by a fixed canvas height.
4. Spatial mode initially measures the rendered flowing works, preserving their positions. Existing flow fields remain stored. A return to flow is an explicit read-only A/B preview. Apply keeps the complete displaced spatial arrangement as a named study, and retains inactive spatial geometry for re-entry. A full study shelf blocks application with a clear explanation; no silent eviction. Cancelling the preview writes nothing.
5. Spatial gestures keep a transient preview and commit once on release. Escape, pointer cancellation, blur, device change and interrupted reload discard it. Keyboard precision is 1 CSS pixel, Shift 10, Option/Alt 0.1. Optional snaps show edge/centre/equal-gap guides; free movement is available. Controls live mainly in the rail above work, with physical 44px targets at preview zoom.
6. Spatial sections hold the existing limit of four works. Cross-section regrouping first requires explicit conversion to flow; the retained spatial study provides recovery. Source deletion prunes only its frame/layer reference; explicit duplication remaps geometry to newly created work IDs. Study application reconciles surviving works and retains current text, typography and original media.
7. v11 adds only optional geometry. v1–v10 migrate without injecting spatial records or altering inherited renders. First mutation atomically retains the exact pre-v11 record as `pre-spatial-sections`. Backup, recovery, immutable releases, backend validation and public HTML/ZIP use the same validated model and renderer. Public output excludes editor controls and private studies.
8. Supported content pages are project, writing and about pages in all ten directions. Direction-specific home covers/navigation remain outside spatial mode. Rotation, animation, arbitrary per-work height/crop, repeated source occurrences and cross-section free placement are outside this increment.

## Implemented interactions

- **Move / Size:** drag a work directly, or use the rail handles. Size changes width; media and writing retain natural height. Arrow keys move 1 CSS pixel, Shift 10 and Option/Alt 0.1. One pointer drag or held-key gesture creates one Undo step. A click without movement does not change content. Escape, cancelled pointers, window blur, viewport changes and reload discard unfinished geometry.
- **More:** precise position and width, layer order, explicit reading order, optional edge/centre/equal-gap snapping, and minimum section height. Number fields permit normal multi-digit entry and commit on Enter or blur. Escape restores their previous value. Option/Alt temporarily bypasses pointer snapping; keyboard placement is unsnapped.
- **Room below:** leaves additional minimum space beneath a section. It cannot force content into a shorter clipping box. Font, text, caption, crop and aspect-ratio changes still determine intrinsic work height.
- **Selection:** a work picker reaches covered artwork. Canvas and keyboard selection keep the rail attached to the chosen work. Controls and precision inputs retain 44px physical targets in Fit; numeric text remains 16px at narrow desktop-preview scales.
- **First conversion:** measures actual flowing work boxes. Unloaded images or film metadata now defer conversion with an inline explanation; the document stays untouched until retry. Original flow fields remain stored.
- **Preview flow:** opens protected A/B. Apply is explicitly **Use flow · keep placement**. It keeps a named study and dormant frames for **Resume placement**. A full 12-study shelf blocks Apply with an explanation. Cancel writes nothing. Studies retain device geometry, layers and reading order while preserving the current words, media and typography when applied.
- **Content scope:** existing project, writing and about pages in all ten directions. Group width, alignment, section spacing and page sequence remain available. Active spatial sections must return to flow before cross-section regrouping; conversion retains their recovery study.

## Verification and evidence

**283 tests in 17 files pass**, including **36 backend cases**, plus lint, client/backend TypeScript and the production build. New tests cover frame bounds, independent source/reading/layer/device ownership, study reconciliation, source removal/duplication, exact Undo, stale writers, original-record recovery, strict malformed-input rejection, backup/import, frozen revisions, SQLite reopen/restore and exported geometry. Local backend media admission remains JPEG/PNG; browser film editing/export is separate and verified.

The build succeeds with a 664.55kB main-bundle size warning and Zod annotation notices; Node reports its experimental SQLite API during tests. Bundle splitting and cold-load performance were not addressed in this increment. [Tests](evidence/spatial-sections/tests.log), [lint](evidence/spatial-sections/lint.log) and [build/type checks](evidence/spatial-sections/build.log) retain the full output.

All browser work used Chromium 145.0.7632.6 on the connected Mac in fresh synthetic workspaces. Each editing script asserts the workspace ID and refuses to replace an existing document. Original geometric media and the original two-second demonstration film supply this milestone's evidence. No artist's draft or artwork was used.

| Evidence                                                                                        | Result                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Full spatial workflow](evidence/spatial-sections/browser-results.json)                         | Image/text/film placement, overlap, separate layers/DOM reading order, keyboard/mouse/emulated touch, one-step Undo, caption/long-text edits, phone independence, protected flow conversion, named studies, reload, frozen release and actual HTML/ZIP parity. A deliberately stalled image also verifies that first conversion leaves the original document untouched until media loads. |
| [Precision and interruption checks](evidence/spatial-sections/interaction-browser-results.json) | Real equal-gap guide/snapping, optional unsnapped movement, right-edge width clamp without moving the left edge, held-key Escape, reload mid-resize, 44px controls and readable numbers at 390/768/1440.                                                                                                                                                                                  |
| [Ten-direction rendered matrix](evidence/spatial-sections/directions-browser-results.json)      | 90 combinations: ten directions × project/writing/about × 390/768/1440. Phone spatial and desktop spatial geometry, source order, layers, intrinsic containment and no horizontal overflow. A large-type/unbroken-text phone case grows to 13,908px without clipping.                                                                                                                     |
| [Archived v10 → v11 comparison](evidence/spatial-sections/migration/browser-results.json)       | All 40 default-render screenshots are pixel-identical: ten directions × phone/desktop × composition enabled/disabled. Migration does not opt an existing section into placement.                                                                                                                                                                                                          |
| Existing browser regressions                                                                    | Independent desktop/phone arrangements, Focus and protected comparison, named/local/phone typography, native line breaks/caret/deletion, phone typing controls and dialog focus all pass again. Their evidence lives in this milestone's `*-regression` subdirectories.                                                                                                                   |

Useful review artifacts:

- [Desktop editor](evidence/spatial-sections/desktop-canvas.png), [390px editor](evidence/spatial-sections/editor-390.png), [phone placement controls](evidence/spatial-sections/phone-placement-controls.png), [narrow desktop precision controls](evidence/spatial-sections/precision-390.png), [protected flow comparison](evidence/spatial-sections/flow-comparison.png).
- [Rendered desktop website](evidence/spatial-sections/standalone.html-1440.png) and [rendered phone website](evidence/spatial-sections/standalone.html-390.png).
- Real [standalone HTML](evidence/spatial-sections/spatial-artist.html), [website-folder ZIP](evidence/spatial-sections/spatial-artist.zip) and [editable v11 backup](evidence/spatial-sections/editable-backup.json). They contain fictional test content. Public exports omit private studies and editor controls.
- Pre-change recovery: [complete v0.15 source archive](recovery/pre-spatial-sections-v0.15.0.tar.gz). Exact pre-v11 browser records are retained on first mutation as **Before spatial sections**, not overwritten during reads.

## Reproduce locally

```sh
cd /Users/habibsaleh/Documents/latent-studio
npm run dev
```

The current server remains on loopback port 5181. Choose an existing local study, open a project/writing/about page, enable its arrangement if necessary, then **Arrange → Place freely**. Use **Mobile preview** to author the phone independently. Edit words or captions in **Edit**; return to **Arrange** for geometry. Use **Preview flow**, cancel, then apply and resume placement to inspect the recovery path. Native film playback is available in Browse and public output.

For an isolated example, open a fresh browser profile or create a fresh UUID `?studio=<uuid>&page=quiet` workspace before explicitly restoring the supplied editable backup. Do not import this fixture over a working artist draft. The automated scripts create and check their own UUID workspaces.

```sh
npm test
npm run lint
npm run build
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers \
node scripts/verify-spatial-browser.mjs
```

Then run `verify-spatial-interactions-browser.mjs` and `verify-spatial-directions-browser.mjs` with the same environment. They use the preceding script's generated synthetic backup/HTML. Regression entrypoints are `verify-independent-viewports-browser.mjs`, `verify-canvas-focus-browser.mjs`, `verify-local-expression-browser.mjs`, `verify-plaintext-browser.mjs` and `verify-type-controls-browser.mjs`; run local-expression before type-controls. The temporary Playwright installation is an execution prerequisite, not a project runtime dependency.

Migration reproduction needs the archived v0.15 source served separately on 5193 and the current workbench on 5181; `verify-spatial-migration-browser.mjs` compares those two immutable inputs. The temporary 5193 server was stopped after verification. Historical milestone evidence is retained separately.

## Responsiveness and candid visual critique

The main browser report records individual pointer-event timings, observed DOM style commits and the actual space available to the canvas. These are local measurements of a four-work synthetic section, not a product-wide performance benchmark or end-to-end display latency. `requestAnimationFrame` callback timing alone does not prove when pixels appeared. No physical-device, high-refresh-rate or large-library performance claim is made.

In the final run, 12 actual pointer-to-work-style mutations measured **3.2ms median / 3.7ms p95**. The 13 event-to-next-animation-frame callbacks measured **0.1ms median / 0.4ms p95**; those callback figures are not a rendering-time claim. The raw samples remain in the browser report.

At a 1000px editor height, Focus gives the preview 810px at a 390px editor width, and 842px at 768/1440. Main controls remain 44px high. Precision inputs measure about 44px with 16px rendered numeric text at all three widths. The 390px desktop-preview popup uses the section's available 265px width; actual phone placement has its own layout. These are measured rendered dimensions, not source-CSS assumptions.

The artwork now has credible freedom: a poem, portrait images and film can share an authored page without forcing a crop or changing the manuscript. The same restrained control vocabulary carries from flow to placement. The common path is three visible controls; deeper choices remain discoverable through More.

The experience still needs polish before a broad launch:

1. Two rails distinguish section actions from work actions, but add density. Covered works are reachable through the picker; a clearer selected-work breadcrumb and transient on-canvas handles could improve orientation without building a permanent layers dashboard.
2. More is readable and touch-sized, yet exposes coordinate terminology. On a phone the popup can occupy most of the visible artwork. Relationship actions should become the common path while precise geometry stays available.
3. Minimum height is safe but can retain extra whitespace after text becomes shorter. Room below needs a clearer visual endpoint and an explicit fit-to-content action in a future polish pass.
4. Intentional overlap can cover captions or writing. The exported fixture demonstrates that risk. Advisories should explain legibility conflicts and offer alternatives; automatic crop changes, type shrinking or forced disjoint placement would damage authorship.
5. Horizontal percentages and vertical pixels do not preserve every artistic relationship at intermediate widths. Desktop/tablet and phone renders have been checked, but they are authored geometries, not semantic constraints. The phone may deliberately flow while desktop overlaps.
6. Film retains native playback and aspect ratio; a considered poster-frame choice would strengthen the first view. Current screenshots are verification artifacts, not evidence that every possible arrangement is aesthetically resolved.

## Smallest next groundwork for relationship-based alternatives

This is a proposed next increment, **not implemented**, and makes no market-first claim. The useful interaction is: select works, express an intention in ordinary language, see a few genuinely distinct rendered studies, compare at the current device, then apply with one Undo and a retained prior study. Precision controls remain available.

The minimum additional model is a small set of explicit intent records keyed to the existing work IDs: together, follows, keep uncropped, dominant/companions and spacing. Each needs device scope, whether it is required or a preference, and provenance showing whether the artist supplied it. Keep these records separate from reading order, layers, content and materialized geometry. Do not infer permanent intentions from an accidental drag.

A single measurement layer should expose intrinsic media proportions, live text/caption bounds and viewport width using the same renderer. The current shared `CompositionWork`, independent viewport sections, stable work IDs, natural-height grid and pure frame functions provide that foundation. Required intentions must survive candidate generation; source/crop/type changes must invalidate measurements without rewriting the artist's words.

Start with one section and a bounded set of relationship-aware alternatives, reusing the existing read-only study comparison and reversible Apply. Each candidate should explain what it preserved and any conflict—for example, longer writing no longer fitting beside a dominant image at phone width. Offer explicit choices rather than silently shrinking type or cropping. Test visual distinctness and content integrity before adding a general solver or conversational complexity.

## Limits

Four works per section; width resize with intrinsic height; no rotation, animation, arbitrary per-work height, free cross-section placement or repeated source occurrences. Direction-specific home covers remain outside spatial placement. Browser checks used Chromium and emulated touch, not Safari/WebKit, a physical phone, VoiceOver or a complete accessibility audit. CJK/IME interaction and broad real-world font/media/device variation remain unverified. Undo history is session-local; named studies, backups, revisions and recovery persist. No publishing or production hosting is implied.
