# Canvas focus and trustworthy comparison — 0.13.0

This milestone improves the existing flowing canvas. It does not add independent viewport groups, local block typography or spatial placement. The document and backup schema remain v8; no infrastructure, publishing, Ritual bridge or default-draft QA writes were performed.

## Confirmed comparison defect and fix

The suspected defect was **reproduced in the live v0.12 editor**, using a new UUID-scoped synthetic workspace. While the UI displayed a read-only study, the sidebar textarea changed the saved page title from “The space between” to “Changed behind comparison”; Undo also changed that hidden draft. [Recorded before-state result](evidence/canvas-focus/before-results.json) and [screenshot](evidence/canvas-focus/before-comparison-leak.png). This is fresh reproduction, beyond the independent review's original inference.

`useStudio` now locks ordinary updates, Undo, Redo, restore and saved-document actions during comparison. The inspector is hidden/inert, draft tools and editing modes are disabled, and hidden file inputs and late callbacks are guarded. Entering comparison closes conflicting panels and invalidates pending file targets. File operations already in progress must finish before comparison begins.

The only explicit write offered by comparison is **Use this arrangement**. Its dedicated transaction reads the current document, retains the displaced arrangement as a study, applies the selected study's arrangement, and creates one Undo item. Current words, captions, source files, crops and focal points remain current. Studies are arrangement snapshots, not frozen content copies. Capacity remains twelve studies per page.

Fresh browser checks start with both Undo and Redo history available, then attempt hidden textarea/reorder events, parent/iframe shortcuts, study mutation controls, upload and restore callbacks. The document remains exact and asset count remains zero. Apply, Undo, cancel and reload are also verified.

## More room for the artwork

**Focus canvas** hides the main header and inspector while keeping Undo/Redo, preview controls and save status reachable. The inspector is collapsible, starts closed on windows up to 1100px, and collapses when entering that narrower range. On phones it opens as a panel below the canvas toolbar. **Fit** keeps a truthful desktop viewport scaled into the available space; **100%** removes scaling and permits horizontal inspection. Release/recovery moves into Draft tools during composition.

Selection actions now sit below the preview. Work selection, **Move work**, **Group 01** movement, width and space controls use a rail above each group's artwork. Their hit areas remain at least 44px even when the desktop viewport is scaled. They no longer cover writing or images. Narrow rails scroll horizontally. Successful work moves offer contextual Undo; cancelled gestures leave selection and the draft intact.

Arrange reserves a minimum gutter for its control rail. This is editor space, not a change to authored section spacing. Browse, comparison and exported websites show the actual composition without that gutter or editing controls.

Measured with the same synthetic image/text selection and a 1000px-high Chromium window:

| Window width | Before: preview top / height | New normal: top / height | New focus: top / height | Before → focus paper width |
| --- | --- | --- | --- | --- |
| 390px | 373.5 / 430px | 240 / 688px | 167 / 761px | 366 → 374px |
| 768px | 356 / 599px | 242 / 676px | 127 / 791px | 461 → 740px |
| 1440px | 341 / 610px | 242 / 676px | 127 / 791px | 1088 → 1412px |

The normal measurements retain the collapsed-inspector state after resizing; the desktop inspector can be reopened explicitly. Focus comparisons are directly repeatable. These numbers describe available preview space, not a claim that every pixel contains artwork.

[Before phone](evidence/canvas-focus/before-390.png) · [Focused phone](evidence/canvas-focus/focus-390.png) · [Before tablet](evidence/canvas-focus/before-768.png) · [Focused tablet](evidence/canvas-focus/focus-768.png) · [Focused desktop](evidence/canvas-focus/focus-1440.png).

## A/B arrangement comparison

Desktop uses two read-only website renders with the same viewport width and zoom. Vertical movement links by stable work ID and relative location within that work. Horizontal inspection at 100% is linked too. At phone widths, clearly labeled **A · Current draft** and **B · Study name** tabs show the same reading position, without forcing two unreadable columns onto the screen.

The website's authored smooth scrolling initially produced reciprocal intermediate-position updates. Comparison restores now use instant scrolling, disable browser scroll anchoring, and track which pane the artist is using. Images in both comparison panes load eagerly, including the hidden phone pane. Comparison-only trailing space lets a shorter arrangement align its final work with a taller one. These adjustments do not change saved content or public rendering.

When comparing an original direction layout without rendered composition anchors, the UI labels the behavior **linked page progress** rather than implying exact work alignment. Arranged-page studies use **linked work position**.

[Desktop A/B](evidence/canvas-focus/comparison-desktop.png) · [Linked location](evidence/canvas-focus/comparison-linked-position.png) · [Phone A](evidence/canvas-focus/comparison-phone-a.png) · [Phone B](evidence/canvas-focus/comparison-phone-b.png).

## Clear typography scope

The selected-writing panel now separates its global control under **All reading text in this direction**, names it **Direction-wide reading scale**, and states that it affects reading text across every page using that direction. It continues to update the existing direction identity token. No local text-style schema or per-block formatting was added. [Actual phone inspector](evidence/canvas-focus/global-reading-scope.png).

## Verification and reproducibility

**200 tests / 13 files**, lint, client/backend types and the production build pass. Four new location-contract tests cover reordered/resized work anchors, negative offsets, smooth-scroll bypass and original-layout fallback.

The focused actual-browser suite verifies layout measurements; control/artwork separation and physical target size; inspector/focus/fit/actual-size changes without draft writes; comparison protection; linked desktop/phone positions; current-content semantics; apply/Undo; editing and reload; and contextual movement cancellation/Undo. The three earlier suites also pass again with the new rail: direct drag acceptance by keyboard/mouse/emulated touch, canvas gesture/study regression, and grouping/mobile alternatives/actual export rendering.

All browser fixtures use separate fresh Chromium contexts and unique `studio=<UUID>` databases. The seeder checks that UUID and refuses any existing document before writing. Only fictional artist copy and original synthetic geometric media are used. The user’s Safari profile and default draft are not used for QA.

- [Focused browser results](evidence/canvas-focus/browser-results.json), [run log](evidence/canvas-focus/browser-run.txt).
- [Direct drag regression](evidence/canvas-focus/drag-regression/browser-results.json), [canvas regression](evidence/canvas-focus/canvas-regression/browser-results.json), [grouping/export regression](evidence/canvas-focus/grouping-regression/browser-results.json).
- [Tests](evidence/canvas-focus/tests.txt), [lint](evidence/canvas-focus/lint.txt), [production build](evidence/canvas-focus/build.txt).
- Actual standalone export reviewed at [desktop](evidence/canvas-focus/grouping-regression/exported-website-1440.png) and [phone](evidence/canvas-focus/grouping-regression/exported-website-390.png), with no editing controls or private studies.

```sh
cd /Users/habibsaleh/Documents/latent-studio
npm test
npm run lint
npm run build
npm run dev
```

Canonical local address: **http://127.0.0.1:5181/**. If already running, do not start a second server on that port.

```sh
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers \
node scripts/verify-canvas-focus-browser.mjs
```

The runner also accepts an installed `playwright` module by default. Historical screenshot sets remain intact; current regressions use the `canvas-focus` evidence folder. Recovery source is `docs/recovery/pre-canvas-focus-v0.12.0.tar.gz`.

## Remaining limits and critique

The new workspace shows materially more art and readable writing. Its control rails make movement scope explicit, but narrow groups require horizontal rail scrolling. Comparison has additional explanatory controls, so its phone viewport is smaller than focused editing; Focus is available there too. Original non-arranged directions synchronize page progress, not necessarily the same visible work. The two-pane comparison eagerly loads media and has not been profiled against a large real-world photographic archive.

Desktop and phone still share group membership. Per-block typography, finer proportions, independent viewport groups/order, and optional spatial sections remain subsequent work. Safari/WebKit and physical iPhone/iPad behavior were not verified; this increment's touch evidence is Chromium emulation. Existing build notices remain experimental Node SQLite, upstream Zod annotations and Vite's editor chunk-size advisory. No new dependencies or hosting services were introduced.
