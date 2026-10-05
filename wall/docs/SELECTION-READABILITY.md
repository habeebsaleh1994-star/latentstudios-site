# Selection and readability — 0.17.0

The selected-work workflow now has one owner and one contextual control surface. The original v0.16 synthetic fixture reproduces its poem/image collision in a **true 768px viewport**; the editor flags the potential occlusion and supports an explicit artist correction. It never silently changes layers, text, crops or caption backing.

Review the running workbench at **http://127.0.0.1:5181/**. The product name remains temporary. No production infrastructure, publishing, domains, billing or native Ritual work was performed.

## What changed

**Exact viewport, distinct layout scope.** Desktop offers Auto, 768, 1024 and 1440 CSS-pixel viewports; phone offers 360, 390 and 430. Fit scales the chosen viewport without changing its wrapping; 100% shows it at actual scale. Desktop and phone remain separately authored layouts. The selector, device buttons and selected-work breadcrumb make width and layout scope visible. Auto retains the previous minimum 1024px desktop behavior; the explicit 768px option exposes actual tablet wrapping. Comparisons use the selected viewport too.

**Recognizable selection.** The compact picker shows real image thumbnails, writing excerpts and a film marker. One selected work ID now drives canvas outlines, the picker, breadcrumb and content inspector. It remains the same work when switching desktop/phone, including when that work is spatial on one device and flows on the other. Picker selection, readability-note selection and Find locate a work; clicking or dragging artwork does not scroll it away. An explicit reveal raises only the editor's temporary drawing order. Escape, End reveal and device switching end it without modifying stored layers.

**One contextual surface.** Spatial controls now sit in a dock below the preview instead of over the artwork. Move and Size remain direct gestures; a temporary width handle sits on the selected work. Position, Layers, Caption, Reading, Section and Readability open progressively in the same surface. The content sidebar is replaced while this work context is active; Edit restores the same work in the content inspector. Section settings retain width/alignment, spacing, ordering, minimum height, the Room below gesture and protected flow conversion. No capability was replaced with a mocked service.

**Precision without accidental rounding.** Numeric displays round to two decimal places, while the stored value is untouched unless the artist edits the field. The exact value remains available in the field's tooltip. Enter/blur apply an edited value; Escape discards it. Pointer gestures and held-key gestures still create one Undo step. Inputs and direct handles retain physical 44px targets; precision input text is 16px.

**Readability feedback.** Spatial sections measure live text ranges, caption sizes and media bounds. Notes identify possible coverage by higher layers, captions geometrically over another image, and captions smaller than 12px. These are potential issues, not proof: transparent imagery, whitespace and actual color contrast are not resolved by this geometry check. The notes never block saving or rewrite the composition. They are not a complete accessibility audit.

**Explicit caption treatment.** For an arranged work, choose above/below its image, no backing/light paper/dark ink, and a readable size. Choices belong to the selected device's section; caption words remain shared. Reset restores inherited styling. Treatments remain in flow, travel with explicit regrouping and duplication, reconcile removed works, and are captured by named studies. Public HTML/ZIP use the same caption renderer and natural height. Original direction layouts remain unchanged when a page's arrangement is disabled.

## Architecture and persistence

- The editor owns selection. Spatial sections no longer keep a competing chosen-work state. Explicit locate requests separate selection from scrolling. Temporary reveal, viewport width, open panels and picker state are session-only presentation, not publication data.
- Direct gestures use one coordinate adapter: artwork events use iframe CSS coordinates, while dock events are converted from the parent viewport into the same coordinates. Preview replacement, Escape, blur, touch cancellation and reload discard unfinished geometry.
- Optional `section.captions` stores treatments keyed to existing work IDs; it is separate from source content, frames, layers and reading order. Desktop/phone and studies reuse the same validated section model.
- Document and editable backup **v12** add no caption defaults. v1–v11 migrate without changing inherited rendering. First mutation retains the exact original record as **Before caption treatments** (`pre-caption-readability`), including during import and revision restore. Strict validation rejects unsupported/foreign/duplicate treatments instead of normalizing them away.
- The existing backend contract accepts v12 and retains treatments through SQLite reopen, release and historical restore. Its media admission remains JPEG/PNG; browser film support is separate. No database schema or hosted provider was added.
- [Pre-change v0.16 source archive](recovery/pre-selection-readability-v0.16.0.tar.gz) preserves the previous implementation. Existing user drafts and other project directories were not used as test fixtures.

## Verification

[Compact verification index and artifact hashes](evidence/selection-readability/verification-summary.json).

**298 tests in 18 files**, including **36 backend cases**, pass with lint, client/backend TypeScript and the production build. New cases exercise caption scope/reset, flow/study retention, regroup/duplicate/remove behavior, strict validation, exact migration recovery, backups, frozen releases and actual deliveries. The SQLite test now also verifies independent desktop/phone caption treatments through reopen, release and restore.

The [test log](evidence/selection-readability/tests.log), [lint log](evidence/selection-readability/lint.log) and [build/type log](evidence/selection-readability/build.log) retain full output. The build succeeds with a 679.40kB main-bundle warning and Zod annotation notices; Node reports its experimental SQLite API during tests.

All browser tests used Chromium 145.0.7632.6 on the connected Mac. Editing scripts generate a fresh UUID workspace and refuse to overwrite an existing document. Media is the original synthetic geometric work and demonstration film from the workbench. Touch is emulated through Chromium, not tested on a physical phone.

| Browser evidence                                                                       | Result                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Selected-work workflow](evidence/selection-readability/browser-results.json)          | Existing offending fixture at exact 768; nonblocking poem occlusion; visual selection and temporary reveal without layer changes; explicit caption treatment and an authored correction; consistent inspector selection; independent phone geometry; exact precision/Undo; studies, protected flow, reload, measured interface area and actual HTML/ZIP parity at 390/768/1440. |
| [Gesture regression](evidence/selection-readability/gesture-browser-results.json)      | Real equal-gap guide/snapping and unsnapped placement; direct artwork selection without scroll jumps; direct 44px resize handle; dock/artwork gestures; edge clamping; separate layer/reading controls; Room below; Undo; keyboard focus loss, Escape, touch cancellation, device switching and reload during resize.                                                           |
| [Ten-direction matrix](evidence/selection-readability/directions-browser-results.json) | 90 rendered cases: ten directions × project/writing/about × 390/768/1440. Current caption treatments, spatial geometry, DOM order, layers, natural containment and no horizontal overflow. Long unbroken writing remains contained.                                                                                                                                             |
| [Legacy comparison](evidence/selection-readability/migration/browser-results.json)     | 40 archived-v0.16/v11 versus current-v12 default renders are pixel-identical, across all ten directions and both viewport modes with composition on/off.                                                                                                                                                                                                                        |
| Previous regressions                                                                   | Independent viewport composition, Focus/protected comparisons, named/local/phone typography, native plaintext/caret editing and phone writing-dialog controls all pass. Current evidence is retained in this milestone's five `*-regression` folders.                                                                                                                           |

The focused-canvas regression caught an extra phone toolbar row introduced by the viewport selector. The final layout keeps the controls in two rows and meets the prior canvas-space limit. Browser review also caught a readability observer attaching to an obsolete preview document; its lifecycle now follows the active document. The gesture check verifies that choosing a work on the artwork does not trigger the picker’s automatic locating behavior.

## Actual space measurements

Measurements use rendered bounding rectangles, including the actual website paper, not only the larger preview region. Each tested window is 1000px tall. The sidebar occupies **0%** during the selected-work workflow because the single dock replaces it; opening the content inspector requires Edit and retains the same selected work.

The final values are recorded in `browser-results.json` under `areas`, for quiet/precision Focus views at 390/768/1440 and normal quiet views at those widths. The dock's quiet height is about **111px (11.1% of window area)**; precision is about **266px (26.6%)**. It sits below the preview and does not cover it. The actual paper-area percentages include borders/gutters and therefore do not exaggerate the artwork area. See the measured table below for the final run.

| Editor width | Mode              | Dock height / window area | Actual paper height / window area |
| ------------ | ----------------- | ------------------------- | --------------------------------- |
| 390px        | Focus · quiet     | 111px / 11.1%             | 685px / 65.7%                     |
| 390px        | Focus · precision | 266px / 26.6%             | 530px / 50.8%                     |
| 768px        | Focus · quiet     | 111px / 11.1%             | 683px / 65.8%                     |
| 768px        | Focus · precision | 266px / 26.6%             | 528px / 50.8%                     |
| 1440px       | Focus · quiet     | 111px / 11.1%             | 731px / 71.7%                     |
| 1440px       | Focus · precision | 266px / 26.6%             | 576px / 56.4%                     |
| 390px        | Normal · quiet    | 111px / 11.1%             | 612px / 58.7%                     |
| 768px        | Normal · quiet    | 111px / 11.1%             | 616px / 59.4%                     |
| 1440px       | Normal · quiet    | 111px / 11.1%             | 616px / 60.4%                     |

These are local interface-space measurements, not end-to-end latency, large-library performance or physical-device usability claims. At 844px phone height there is less room than the 1000px table; the complete phone gesture flow is separately exercised at 390×844. The system's virtual keyboard was not emulated.

## Review artifacts and reproduction

- [Visual work picker](evidence/selection-readability/visual-picker.png), [reported tablet collision and feedback](evidence/selection-readability/tablet-occlusion.png), [temporary reveal](evidence/selection-readability/temporary-reveal.png), [explicitly adjusted tablet composition](evidence/selection-readability/tablet-authored-adjustment.png).
- [Phone precision](evidence/selection-readability/editor-390-precision.png), [quiet tablet workspace](evidence/selection-readability/editor-768-quiet.png), [normal desktop workspace](evidence/selection-readability/editor-1440-normal.png).
- [Actual standalone website](evidence/selection-readability/artist.html), [website-folder ZIP](evidence/selection-readability/artist.zip), [editable v12 backup](evidence/selection-readability/editable-backup.json). These contain fictional evidence content. [Desktop export screenshot](evidence/selection-readability/standalone.html-1440.png), [tablet](evidence/selection-readability/standalone.html-768.png), [phone](evidence/selection-readability/standalone.html-390.png).

```sh
cd /Users/habibsaleh/Documents/latent-studio
npm run dev
```

The current editor remains on loopback 5181. In an isolated demo, open an arranged project, choose Place freely, then select a work visually. Set the viewport to 768px, inspect Readability, try Reveal and cancel it, then make an explicit treatment or placement change. Switch to phone and verify its independent layout with the same selected work. Use Edit to inspect shared caption words; return to Arrange for its device-specific treatment.

```sh
npm test
npm run lint
npm run build
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers \
node scripts/verify-selection-readability-browser.mjs
```

Run `verify-selection-gestures-browser.mjs` and `verify-readable-directions-browser.mjs` with the same environment. The direction matrix uses the full workflow's generated HTML. `verify-readable-migration-browser.mjs` additionally needs the archived v0.16 source on loopback 5193; that temporary server was stopped after verification. The five previous regression entrypoints are independent-viewports, canvas-focus, local-expression, plaintext and type-controls; run local-expression before type-controls. Historical v0.16 spatial scripts describe the previous in-canvas surface; the two new selection suites cover their interaction contracts through the current UI.

## Candid remaining limits

The workflow is more coherent, but precision still costs real space. On a phone, the secondary settings strip scrolls horizontally, the visual picker opens within the same dock, and long Readability/Section panels scroll vertically. Those choices preserve capabilities and keep the artwork unobscured, but discoverability needs an artist usability pass. A large selected work may exceed the visible canvas; Find recentres it, and Reveal does not fit or shrink it.

The picker uses real image thumbnails and text excerpts; films currently have a recognizable film marker, not extracted poster thumbnails. The breadcrumb abbreviates long writing, with the full work available on canvas. Selection and preview-width choices reset on reload; authored treatments, geometry, source, studies and recovery persist.

Occlusion analysis is local to spatial sections and geometric. It can produce conservative warnings for transparent imagery or whitespace and does not measure pixel contrast, assess every original home/reading layout, or certify accessibility. Manual overlap remains possible by design. Captions can be positioned above/below and backed, but there is no separate caption-drag model or typeface override for captions in this increment.

The four-work ceiling, explicit flow conversion before regrouping, and direction-specific home-cover exclusion remain. Safari/WebKit, VoiceOver, physical touch, CJK/IME and broad media/font/device variation remain unverified. The build's bundle-size warning remains; no cold-load performance claim is made.

Persistent relationship rules and content-aware layout generation remain deferred. The dependable prerequisites here are a single selected-work owner, honest viewport geometry, explicit per-device presentation, measured readability evidence and reversible studies. A later relationship experiment should build on these, preserve exact content/intent, and explain conflicts without silently shrinking type, reordering layers or cropping media.
