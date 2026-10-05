# Direct grouping and responsive composition — 0.11.0

The chosen increment is direct work selection, reviewed grouping/separation and device-specific alternatives. Optional spatial placement is **not implemented**. Flowing sections remain the only layout model. This step establishes predictable shared content and reading-order rules before overlap or free placement is introduced.

## What works

In **Arrange**, click or tap an artwork or its selection control. Shift-click extends a range; on a focused work control, Space toggles selection and Shift+arrow extends it in the current device's reading order. Escape clears selection. Work selection is distinct from the section grips: only a grip moves a section. On phones the explicit work targets are 44px; the full artwork is also a touch target.

**Group selected** accepts 2–4 contiguous works, including members taken from different existing groups. **Separate selected** extracts selected members; remaining contiguous companions stay grouped where possible. Neither action mutates content while being reviewed. A current/proposed comparison has desktop and mobile views, a fitted overview and full-width inspection. Apply creates one Undo item, and selected work IDs survive grouping, separation and Undo/Redo.

A new group starts in equal desktop columns and a mobile stack. The first affected section supplies its width, alignment and spacing settings. Splitting an old group can resize unselected companions; the dialog explicitly states this and includes those companions in its comparison. Other sections keep their geometry. No work is cropped, replaced, duplicated or quietly reordered to make a group fit.

Both complete reading orders are locked. A desktop gap, interleaved mobile sequence or internal mobile order that cannot be represented by the current forward/reverse group model blocks Apply. The explanation shows numbered desktop/mobile orders and highlights the selected works. It does not offer a hidden override. The sidebar grouping path opens the same review; the underlying `groupSections` and `canGroup` operations now use the same policy.

**Try group arrangements** has explicit desktop/mobile tabs. Multi-work mobile choices are **One at a time**, **Side by side** and **A quieter column**; one-work mobile sections offer only two genuinely distinct choices. Each changes only the selected device's geometry. Mobile order/reversal, the other device, identity, source media, text, captions, crop and focal decisions are retained. Switching device tabs resets an unavailable choice. Applying an alternative is one Undo step.

Named studies retain the new grouping and mobile layout using the existing geometry-only snapshots. Comparisons reuse current content without changing the draft. No new document format was necessary: document/backup **v8** and all earlier migration/recovery paths remain supported. Both public export formats retain the chosen layout and omit private study metadata.

## Interaction critique

It is now easier to pair an image with writing directly where they appear, pull one work out of a group, and try a different mobile rhythm without rebuilding content. The current/proposed overview makes a partial regroup's consequences visible; full-width inspection reveals the actual size relationships. Touch selection can use the artwork surface itself. One-step Undo makes these choices reversible.

The flow is still deliberate rather than fluid. Grouping opens a review dialog instead of accepting a drag directly into another group. Groups share boundaries across devices, so a mobile interleaving may make a desired desktop group impossible without an explicit earlier resequence. Independent per-device group membership is not supported. Fitted previews scale each composition separately, so they are an overview, not a same-scale size comparison; inspection mode is provided for that distinction.

On a tablet, the desktop site scales to fit its true desktop viewport. The whole artwork remains easy to tap, but small geometry grips and typography shrink. Larger editor controls outside the scaled artwork, clearer device/zoom control and an optional wider canvas would improve the next iteration. Selection markers can also sit over content in Arrange mode; Browse and exported sites have no markers.

There is no free positioning, overlap, layer order, rotation, arbitrary coordinates, lasso selection, drag-to-regroup or generated composition intelligence. These are not mocked as available controls. A useful next step is a direct insertion interaction with clear destinations and larger tablet affordances, followed by an optional spatial section model with explicit mobile reading-order ownership. Preserving these guarantees should precede adding absolute-positioned elements.

## A phone bug found and fixed

The first keyboard move after clearing selection could cancel immediately. DOM event inspection showed that changing the toolbar action from “Artist studies” to “Done” increased its height by 2px, shrinking the iframe from 437px to 435px and triggering the existing resize cancellation. The inspector's `scrollIntoView` also scrolled the outer phone page.

The toolbar actions now have stable dimensions. Inspector scrolling is restricted to its own clipped scroll region. The regression check asserts that starting a phone gesture retains the iframe height and outer page scroll position; it then actually moves the section and exercises the resulting mobile-order conflict. Real viewport changes and Escape still cancel unfinished gestures.

## Evidence and exact checks

- **189 tests across 11 files pass**, including 15 new tests. Coverage includes partial regrouping, separating selected members, forward/reversed reading orders, a 240-case selection/mobile-order matrix, policy conflicts, exact source preservation, Undo/Redo, current-content studies, v8 backup round trips, per-device alternatives and both public export formats. All earlier migration/recovery and backend tests still pass.
- **Lint, client TypeScript, backend TypeScript and production build pass.** Existing nonfatal warnings remain: experimental Node SQLite, third-party Zod annotation comments and the editor's 603.34 kB minified chunk exceeding Vite's 500 kB warning threshold. Dependencies were not changed.
- **Actual Chromium 145 UI checks pass** at 360, 390, 768 and 1440px. Work selection, Shift/keyboard ranges, desktop/mobile grouping review, cancellation, Apply, separation, stable selection through Undo/Redo, named study comparison/reload and device-specific alternatives were exercised. No horizontal overflow was found. Phone selection targets were measured at 44px or greater.
- **Phone and tablet touch input passed.** A separate 768px check tapped full artwork surfaces, reviewed the mobile companion and applied the grouping. This used Chromium's touch emulation, not a physical tablet.
- **The previous complete canvas gesture suite passes again**, including pointer autoscroll/reorder, snapped width, keyboard spacing, exact Undo/Redo, caption editing, independent mobile reorder, gesture cancellation, interrupted reload, touch resize/cancel and scaled desktop pointer geometry.
- **Standalone export was actually rendered** at 390 and 1440px. The exported HTML had the current grouped reading order, spacing, crop class and focal point, with no editor controls or private study name. The self-contained synthetic file is [grouped-artist.html](evidence/direct-grouping/grouped-artist.html).

[Grouping browser results](evidence/direct-grouping/browser-results.json) · [tablet touch result](evidence/direct-grouping/tablet-touch.json) · [earlier canvas suite rerun](evidence/direct-grouping/canvas-regression/browser-results.json) · [tests](evidence/direct-grouping/tests.txt) · [lint](evidence/direct-grouping/lint.txt) · [build](evidence/direct-grouping/build.txt).

Review screenshots: [direct selection](evidence/direct-grouping/selected-works-desktop.png), [grouping comparison](evidence/direct-grouping/grouping-review-desktop.png), [mobile companion](evidence/direct-grouping/grouping-review-mobile-companion.png), [three mobile alternatives](evidence/direct-grouping/mobile-alternatives-desktop.png), [390px selection](evidence/direct-grouping/canvas-selection-390.png), [tablet touch](evidence/direct-grouping/tablet-touch-grouping.png), [mobile-order conflict](evidence/direct-grouping/mobile-order-conflict-phone.png), [exported phone site](evidence/direct-grouping/exported-website-390.png).

All browser tests used fresh in-memory Chromium contexts and random, previously nonexistent synthetic workspaces, refusing to overwrite an existing document. The earlier default-database fixture denial was respected. No Safari profile or user draft was accessed. Mira Vale, captions and writing are fictional; geometric works and film are the original bundled demo assets. Safari/WebKit, physical-device and full assistive-technology verification remain outstanding.

## Run and reproduce

Canonical editor: **http://127.0.0.1:5181/**. Run `npm run dev` in `latent-studio-workbench` if it is not running. Use any content page and choose Arrange. No publishing, account, quota, hosting or Ritual work was performed.

The browser runner is `scripts/verify-grouping-browser.mjs`. It seeds only a unique synthetic workspace through application modules, then uses actual UI input and DOM/storage assertions. With the separately installed temporary Playwright runtime:

```sh
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers \
node scripts/verify-grouping-browser.mjs
```

The previous runner accepts `LATENT_CANVAS_EVIDENCE` to keep new regression evidence separate from the 0.10 screenshots. Temporary test tooling is not an application dependency. The source recovery archive is `docs/recovery/pre-direct-grouping-v0.10.0.tar.gz`; it contains no user browser data.

Native Library attachments remain unavailable in this Mac execution runtime and were not retried. The verified local screenshots above are the deliverables; no Library file IDs were created for this increment.
