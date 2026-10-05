# Direct work gestures — 0.12.0

This increment adds direct work dragging and adaptive canvas controls to the existing local editor. It retains document/backup version eight. No hosting, infrastructure, Ritual bridge, default browser draft, or other project was changed.

## Interaction contract

In **Arrange**, select works by tapping their surface or selection marker. Selected works acquire a grip distinct from the selection control. Drag any selected grip:

| Target | Result |
| --- | --- |
| Centre of a section | Group the selection and the target's works, up to four. Both complete reading orders stay fixed. |
| Space/edge between sections | Move whole selected sections in the current device's sequence. An explicitly authored phone order survives a desktop move. |
| Grouping that extracts members and resizes unselected companions | Open the existing current/proposed desktop/phone comparison. Apply once; Undo once. |
| Reading-order conflict, partial-group between drop, stale target, or no-op | Explain the refusal inline; preserve the draft and selection. No automatic reorder or crop override. |

Grouping separate image/text works and moving whole selected groups commit directly on release. The toolbar's simple grouping and complete separation actions also commit directly. Complex partial separations retain review. Each accepted change is one history transaction. Media, words, captions, crop, focal point, and stable IDs are retained; moving desktop sections necessarily updates the canonical source sequence. Selecting works does not write the draft.

Centre targets use a section outline; between targets use a placement line. The live message describes the intent and whether it can apply. Other section controls hide during a work drag so they do not compete with the placement preview. No native image drag, text selection or content editing occurs in Arrange.

Keyboard: focus a selected work's grip; **Space/Enter** lifts it, **arrows** choose successive centre/between targets, **Home/End** reach the first/last gap, **Enter/Space** places, and **Escape** cancels. Window blur, viewport change, pointer cancellation and reload discard transient work gestures. Command/Ctrl-Z during a lifted gesture cancels that gesture; it does not also undo an earlier edit. Keyboard target scrolling stays inside the preview.

Desktop artwork retains a true minimum 1024px viewport when its iframe is scaled. `PreviewFrame` now supplies the inverse display scale to editor controls, preserving 44px physical hit areas for work selection/grips and section movement/width/space. Compact tablet controls abbreviate the arrangement button and work count. Small circular marks reduce the visual footprint while their hit areas remain 44px. These controls and scaling tokens do not appear in the exported website.

## Mobile boundary assessment

Phone section order, stack/columns, reversal, width, gaps and spacing are independently editable. **Group membership remains shared with desktop.** Grouping may therefore be refused when a phone sequence interleaves members, or asks for an internal permutation other than forward/reverse. The editor explains the constraint rather than silently modifying the other device.

Decoupling this safely requires a document migration, not a renderer exception. `Composition.sections` currently owns canonical desktop block order, while `mobileOrder` references those same section IDs. Validation, group/split/delete reconciliation, studies, backup import, saved revisions and the standalone renderer all rely on that contract. A future model should give each viewport its own section collection referencing the same immutable block identities; validate complete unique coverage and independent order in each; migrate v8 mobile groups explicitly; and update studies, reconciliation and exports together. This increment deliberately leaves that work deferred. No extra shadow layout or duplicate content was introduced.

## Verification

Run from the project directory:

```sh
npm test
npm run lint
npm run build
npm run dev
```

**196 tests / 12 files pass**, including seven new drop-policy tests. Lint, client/backend type checks and the production build pass. The tests cover exact content/geometry preservation, independent phone movement, explicit desktop reordering, companion review, invalid/duplicate/stale targets, no-op refusal and interleaved reading orders. Existing tests cover persistence, migration, studies, recovery and actual export behavior.

Actual browser verification used isolated Playwright Chromium 145 contexts on this Mac, with unique `studio=<UUID>` IndexedDB namespaces. Fixture code asserts the active UUID and refuses to overwrite any existing document. It uses only original synthetic geometric media and fictional artist copy. It never writes a QA fixture to the default draft or uses the user's Safari profile.

`scripts/verify-work-drag-browser.mjs` repeats the complete path for keyboard, mouse and Chromium emulated touch:

1. Separate image + text → select → direct group gesture → exact one-step Undo/Redo.
2. Move the selected group between sections, preserving its geometry and the explicit phone order.
3. Resize → edit caption → phone-only width change → one Undo, comparing the entire resulting document to the preceding state.
4. Cancel keyboard/pointer/touch moves, reload mid-gesture, and verify the last saved document and stable selection.
5. Check 360/390/768/1440 layouts for overflow and 44px physical work/section control bounds.
6. Refuse conflicting drops inline without mutation; retain review and exact Undo for ambiguous regrouping.

The existing canvas suite passes again, including autoscroll, width/spacing, keyboard repeats, Command-Z in the iframe, studies, interrupted editing and scaled tablet desktop resizing. The updated grouping suite passes again, including mobile alternatives, shared-boundary conflicts, study persistence and actual standalone HTML rendering at desktop/phone sizes. No browser page errors were recorded.

Evidence:

- [Acceptance results](evidence/direct-drag/browser-results.json), [canvas regression](evidence/direct-drag/canvas-regression/browser-results.json), [grouping/export regression](evidence/direct-drag/grouping-regression/browser-results.json).
- [Tests](evidence/direct-drag/tests.txt), [lint](evidence/direct-drag/lint.txt), [build](evidence/direct-drag/build.txt).
- [Desktop group target](evidence/direct-drag/pointer-group-preview.png), [between target](evidence/direct-drag/pointer-between-preview.png), [tablet](evidence/direct-drag/controls-768.png), [phone arrangement](evidence/direct-drag/touch-phone-arrangement.png), [inline refusal](evidence/direct-drag/pointer-inline-conflict.png), [partial regrouping review](evidence/direct-drag/pointer-ambiguous-review.png).
- [Actual rendered standalone website](evidence/direct-drag/grouping-regression/exported-website-1440.png), [phone export](evidence/direct-drag/grouping-regression/exported-website-390.png).

For the configured local runner:

```sh
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers \
node scripts/verify-work-drag-browser.mjs
```

The runner also accepts an installed `playwright` module by default. Earlier regression runners accept `LATENT_CANVAS_EVIDENCE` / `LATENT_GROUPING_EVIDENCE` output directories to preserve historical artifacts. All automated browser evidence is **Chromium**, including touch emulation; no actual Safari/WebKit or physical iPad/iPhone pass is claimed. A supported Safari automation workflow and local WebKit binary were unavailable. Local screenshots are the deliverables; no Library upload was retried.

## Candid design critique and remaining work

Direct grouping and sequence moves no longer require routine modal confirmation. The drop feedback clearly distinguishes shared grouping from current-device placement, and the original draft remains visible throughout. Partial regrouping still benefits from comparison because an unselected companion can resize.

This remains a flowing-section editor. Between drops move whole groups; extracting only part requires explicit separation or a regrouping target. There is no free placement, overlap, rotation, layering, lasso, snapping to arbitrary coordinates, or independent phone group membership. Short text and very narrow groups can still sit close to selection controls; the larger touch targets make that tradeoff more apparent. The scaled tablet canvas also makes the actual artwork text small even though controls remain usable. A future spatial/design review should address the relationship between local controls, touch targets and readable artwork without changing published geometry.

Known build notices remain Node's experimental SQLite warning, upstream Zod annotation notices, and the editor bundle exceeding Vite's 500KB advisory. There are no new dependencies. The pre-increment source archive is `docs/recovery/pre-direct-drag-v0.11.0.tar.gz`; no user draft is included. The local Vite server remains at **http://127.0.0.1:5181/**.
