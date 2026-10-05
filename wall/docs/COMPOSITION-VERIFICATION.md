# Flexible composition verification — 2026-10-04 UTC

## Current result

**http://127.0.0.1:5181/** remains the canonical workbench. Package **0.4.0**, document **v4**. The earlier 5178/5179 projects and Safari session were untouched. Only isolated fictional studios were edited for this milestone; the main 5181 draft was not modified by QA. Existing saved pages keep their current presentation until the artist explicitly changes it. Fresh demo stores seed the authored arrangements reviewed below; existing demo work is not overwritten.

Development server 5181 is running. The built bundle was served temporarily at 5182, tested, then stopped. TypeScript (`tsc -b` within build), ESLint, **49 tests**, formatting, and production build passed. Two existing Zod annotation warnings were stripped by Rollup. Output: CSS 66.51 kB / 13.78 kB gzip; JS 477.59 kB / 139.31 kB gzip.

## Implemented scope

Explicit, non-nested sections containing 1–4 original blocks. Adjacent sections may be grouped when they total at most four works. Desktop arrangements: stack, equal columns, 60/40, 40/60; full/84%/64% widths; left/center/right edges; vertical alignment; gap and space before. Mobile has independent section order, stack/two-column layout, reversal within a section, width, gap, and space before. The responsive breakpoint is 640px; there is no third tablet-specific editor yet.

Groups, ungrouping, section/member reordering, duplication, removal, layout choices, and original-layout toggle all use the same undo/save history. Text/captions remain directly editable; media selection targets the original block. Originals, explicit crops, and focal points are retained. Duplication creates independent block/section IDs while referencing the same original media.

Composition is an optional scrolling presentation for project, writing, and about pages in all four directions. Homepage covers, navigation, and index designs remain direction-specific. Gallery/Cinema/Archive original viewers remain accessible through the explicit original-layout toggle; a saved arrangement is retained. When it exists, section ordering remains owned by the arrangement panel, so old individual-block move controls are disabled with guidance to return there.

## Automated evidence

The existing 34 storage, identity, legacy migration, grouped-history, save-queue, and recovery tests still pass. `tests/composition.test.ts` adds **15** behavioral tests covering:

- Nondestructive v3 read and exact `pre-composition-system` record on first edit.
- Real v3-shaped backup import preserving identity, copy, source media, and focal/crop values.
- Invalid/orphan/duplicate/out-of-order section and mobile references rejected without overwriting a valid draft.
- V4 arrangement backup, import, save/load roundtrip and stale legacy writer rejection.
- Grouping with unchanged source content; non-adjacent/oversized selection rejected.
- Desktop reordering with independent mobile order and ungrouping a reversed mobile pair without changing mobile reading order.
- Independent duplicated blocks, remove/undo/redo, add/remove reconciliation, and stable direct-edit targets after grouping/duplication/member moves.
- All four renderer choices and original-layout toggle preserve the document; all four fictional studios can be arranged without mutating seeds.

## Actual browser checks

Local app on the connected Mac using the in-app browser. Four standalone studies were visually inspected at **1440×960 desktop** and **390×844 mobile**. All mobile document widths measured 390px. Editor mobile frames also use the actual iframe viewport; the production frame measured 388px of content within its 390px presentation.

| Check | Observed evidence |
|---|---|
| Group and geometry | Sora's first two works grouped through real checkboxes. Desktop 60/40 columns measured 337.828 / 225.234px; a second text section remained distinct. |
| Separate mobile order | Desktop Sora order `b1,b2,b3`; mobile `b3,b2,b1`. Actual DOM order changes, not only CSS visual order. Reload retained both. Optional mobile columns measured 158.734px each; Undo returned the stack. |
| Structural history | Duplicate increased Sora's blocks 3→5; Undo restored 3. Ungroup produced 3 sections; Undo restored the pair. Removing the pair left one text block; Undo restored all three source blocks. |
| Inline edit and keyboard | Edited a caption inside the pair; contextual field matched; Cmd-Z restored the original. Enter selected the section, with a visible solid outline. |
| Direction switching | Folio → Cinema → Archive → Gallery kept the same three arranged block IDs and order. Original Gallery viewer returned on toggle; reenabling restored the arrangement. |
| Photographic study | Mara's image/text pair and two-image section rendered; mobile led with writing. Three images' displayed/intrinsic ratios matched within 0.00005; object-fit was contain, focal position unchanged at 50%/50%. |
| Writing study | Noor's two writing blocks used weighted desktop columns with bottom alignment; mobile became a readable single column. |
| Mixed media | Ivo's film/text pair and surrounding photos rendered. Mobile began with text, then film, then source photographs. Native film duration 2s, readyState 4, controls enabled, aspect ratio ~1.7778. |
| Stale editor | A second Sora editor displayed “Another window saved this draft” with export action after the first changed the gap. The original editor undid the temporary change. |
| Portable export | Actual Copy backup JSON action produced a v4 file containing the two sections and mobile order. The artifact is saved below. |
| Production bundle | Fresh built Sora studio grouped two works, reversed them on mobile, and retained two sections after reload. No warning/error console logs. The final bundle also opened a fresh Noor studio with its authored two-work composition and no console errors. |

## Screenshots and artifacts

| Study | Desktop composition | Mobile composition |
|---|---|---|
| Mara / Folio | [Image and writing](evidence/composition-mara-desktop.jpg) | [Writing leads](evidence/composition-mara-mobile.jpg) |
| Sora / Gallery | [Weighted pair](evidence/composition-sora-desktop.jpg) | [Independent order](evidence/composition-sora-mobile.jpg) |
| Noor / Archive | [Writing columns](evidence/composition-noor-desktop.jpg) | [Reading stack](evidence/composition-noor-mobile.jpg) |
| Ivo / Cinema | [Mixed-media sequence](evidence/composition-ivo-desktop.jpg) | [Film and interlude](evidence/composition-ivo-mobile.jpg) |

[Selected-section editor](evidence/composition-editor.jpg) · [Stale-window warning](evidence/composition-stale-window.jpg) · [Production preview](evidence/composition-production-preview.jpg) · [Actual exported v4 backup](evidence/composition-browser-backup.json).

Source before this milestone: `docs/recovery/pre-composition-source-v0.3.0.tar.gz`. This is code recovery, not a browser-data rollback. Exact pre-migration browser records are retained transactionally on first save. [Prior identity verification](IDENTITY-VERIFICATION.md) remains available; its screenshots are not counted as new composition evidence.

## Explicit limits

No freeform canvas, nesting, arbitrary grids, drag-and-drop, or separate tablet breakpoint. Grouping uses adjacent source sections and starts the new group with stated defaults; no automatic regrouping or image crop is applied. Covers/index/homepage layout remain authored by the selected direction. Spacing/section widths are the arrangement's choices; media scale and text styling still come from the site identity.

File chooser automation previously stalled for about 14 minutes. It was not retried this milestone. V4 import/legacy import and recovery are tested at the storage/schema boundary; **a new v4 browser file-restore run and completed native download receipt remain unverified**. Actual v3 restore was verified in the prior milestone. No pending chooser or current blocker remains.

No new upload/decode race, forced process termination, quota exhaustion, physical-device, full screen-reader, or cross-browser certification. Original upload targeting and save-queue contracts remain intact and their regression tests pass. No browser user data was reset or automatically copied. Session undo still ends at reload.

No accounts, cloud service, deployment, remote push, purchase, domains, billing, or artwork publication. Four artist samples are simulated design coverage, not research.

## Next increment

[Publishing foundation implementation plan](PUBLISHING-FOUNDATION.md): immutable local revisions, visible recovery, separate draft/local release snapshots, preflight, portable static export, and storage/publication interfaces. External provider/account ownership, cost ceiling, access policy, exact publication scope, and DNS changes need user decisions only when proceeding to real services.
