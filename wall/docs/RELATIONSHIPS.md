# Relationship exploration — v0.18

Completed and verified locally. [Evidence index and artifact hashes](evidence/relationships/verification-summary.json).

Intentions guide explicit exploration; they are not live layout constraints. “Together” requires a shared section. “Follows” requires immediate DOM/reading order on the selected device, not visual layering. Manual editing remains unrestricted. Scopes are Desktop, Phone, or both. An optional remembered intention is persisted only when applying a candidate; otherwise it lasts for this exploration. Crops, focal points, typography, identity, source words and media remain unchanged.

A selected image and writing form the first workflow. Up to four works in the affected, adjacent sections are supported. Other works in those sections remain in the preview and retain content; the dialog discloses their inclusion. A candidate may change grouping/reading order and responsive flow geometry. Spatial sections must be in flow before cross-section grouping; an existing single spatial group can be previewed in flow while keeping its dormant frames. Apply keeps the whole previous arrangement as a named study, in the same Undo transaction.

Remembered intentions are optional page metadata in document/backup v13. Studies capture intentions with arrangement and reconcile removed work references against current content; public websites omit both. Missing references, duplicate/overlapping intention scopes, competing immediate successors/predecessors and directed reading-order cycles are rejected. Deletion removes live references atomically; old studies remain available and reconcile upon application. Existing v1–v12 reads add no intentions, and the first write/import/restore retains the exact raw prior document as Before composition intentions.

Placement holds are deliberately temporary and conservative: the entire containing section and its index must remain unchanged. They never become a second persistent geometry model. Candidates that violate a hold or remembered intention are blocked with a reason; constraints are never relaxed. Actual rendered content is checked before Apply becomes available. This is deterministic exploration, not AI or a general-purpose layout solver.

## What is implemented

In Arrange, select an image or writing and choose **Explore image + writing**. The existing selected-work dock or work-selection bar owns this entry; no separate dashboard is introduced. Choose the companion work, Together/Follows, and **Desktop only / Phone only / Desktop + phone**. **Remember on Apply** is explicit; clearing it makes the new intention temporary. The selected scope is repeated beside Apply. Remembered chips can be removed without moving any work, with Undo.

The explorer starts with the actual current website. It offers three deterministic candidates: **In conversation**, **The image leads**, and **A reading sequence**. Image aspect (or the artist's existing crop shape), writing length and inherited/named/local measure influence geometry. Candidate records reuse current work IDs and values. Desktop uses differing column ratios or a vertical sequence. Phone intentionally keeps a vertical reading order and varies width and spacing; it does not pretend to provide three structurally different phone layouts.

Every candidate is rendered with the real site renderer, decoded originals and current typography before becoming applicable. Desktop is checked at 768 and 1440px; phone-only at 390 and 430px; both-device exploration at 768, 1440 and 390px. The selected writing is checked for approximately 16 characters of available reading width, overflow, overlap and uncropped image proportions. Failed candidates are omitted with their reason. The review menu clearly labels widths outside that exploration's checks. These geometric heuristics are conservative filters, not an accessibility or aesthetic guarantee.

The main editor's mutation controller is locked during exploration. The preview has no editing provider. Escape works from the form and the embedded website; browser Undo cannot edit the hidden draft. Apply recomputes against the exact source page, rejects a stale preview, and commits candidate geometry, optional remembered intentions and the displaced arrangement's study together. If the study shelf is full, Apply is disabled with an explanation. Unfinished exploration is not saved and does not create recovery debris.

## Observed task walkthrough

The concrete task was: starting with an image selected in an existing two-work spatial section, place that image immediately before its writing, retain them as one section, and make desktop columns plus a phone reading flow while preserving original content. The existing manual controls from v0.17 were exercised in the current build; an archived v0.17 binary was not used. The outcomes meet the same task goal, but their pixel geometry differs.

| Workflow | Observed control actions | Document mutations |
| --- | ---: | ---: |
| Existing manual controls | 11 | 4 |
| Relationship exploration, accepting the first valid alternative | 4 | 1 |

Manual actions were Reading → Read earlier → Section → Preview flow → Use flow, then Mobile preview and the same five actions. The relationship path was Explore image + writing → choose Desktop + phone → Explore compositions → Apply In conversation. Source files, words, crop/focal values, type and identity were retained. The new path keeps the whole previous arrangement in one study and has one Undo.

This bounded workflow does reduce actions. It does not establish faster artistic decision-making: choosing another writing work, comparing alternatives or reviewing another device adds interactions. No artist usability study or market-novelty claim is made. [Recorded walkthrough and boundary results](evidence/relationships/boundaries-browser-results.json).

## Verification

**318 tests in 19 files**, including **36 backend cases**, pass. [Tests](evidence/relationships/tests.log), [lint](evidence/relationships/lint.log), client/backend types and [production build](evidence/relationships/build.log) pass. The build retains a 700.48kB main-bundle warning and Zod annotation notices; Node reports its experimental SQLite API.

Unit/contract coverage includes distinct candidates, original records, device isolation, together without following, temporary intentions, unaffected-scope retention, placement conflicts, stale application, one-step history, spatial safeguards, current-content studies, deletion and duplication, invalid references, self-reference, cycles, conflicting immediate order, duplicate scopes, historical feature gating, exact raw v12 preservation, backups, revisions and public stripping. The real SQLite harness verifies intentions through reopen and restore. Its private frozen release retains editable metadata; its public artifact omits intentions and studies. No live backend or infrastructure was changed.

[Full browser evidence](evidence/relationships/browser-results.json) uses Chromium 145.0.7632.6 on this Mac. It verifies actual alternatives at 768/1440/390, original metadata, zero pre-Apply mutation, the hold conflict, keyboard/read-only guards, touch Apply, Undo/Redo, cancel, chips, studies, reload/recovery, actual plaintext edits and real HTML/ZIP output parity at 390/768/1440. [Boundary evidence](evidence/relationships/boundaries-browser-results.json) adds the manual walkthrough, large type filtering, exploration-only and desktop-only application, inspector deletion and recovery, and intention removal in the ordinary flowing selection bar. Fresh UUID workspaces assert their identity and refuse to replace an existing document.

The large-type fixture retains authored 32px text and offers **two** valid alternatives; image emphasis is rejected at 768px because the writing column is too narrow. Holding the pair's original sections offers **zero**, with an explicit conflict. The normal fixture offers three geometrically distinct alternatives on both checked device modes. At 768px the original image is about 306px wide in conversation, 410px in emphasis and 437px in sequence; text remains 24px. On phone the image widths are about 309/343/268px, with the authored 18px writing retained.

The earlier [gesture regression](evidence/relationships/gesture-regression/gesture-browser-results.json), [focused/read-only study regression](evidence/relationships/focus-regression/browser-results.json) and [independent-device composition/export regression](evidence/relationships/independent-regression/browser-results.json) also pass. An earlier keyboard-move regression failed with the new entry in a separate row. The entry was consolidated into the existing flowing control bar, and the regression passed on the subsequent and final runs; the precise event ordering of that earlier failure was not instrumented. Earlier milestone evidence was retained. This increment did not repeat the ten-direction 90-case/legacy pixel matrices; their earlier results are historical, not a new relationship compatibility claim.

## Review and reproduction

- [Three alternatives on desktop](evidence/relationships/three-alternatives-desktop.png), [image emphasis](evidence/relationships/candidate-the-image-leads.png), [phone exploration](evidence/relationships/phone-exploration.png).
- [Two honest alternatives with large type](evidence/relationships/fewer-readable-alternatives.png), [placement conflict](evidence/relationships/placement-conflict.png), [prior arrangement comparison](evidence/relationships/prior-study-comparison.png).
- [Rendered website](evidence/relationships/artist.html), [website ZIP](evidence/relationships/artist.zip), [editable v13 backup](evidence/relationships/editable-backup.json). All use fictional writing and the bundled original geometric image. The actual text-edit verification is reflected in the final export.
- [Source recovery archive](recovery/pre-relationships-v0.17.0.tar.gz). Existing user drafts, media libraries, other projects and prior recovery records were not used as test data.

Open the running editor at **http://127.0.0.1:5181/**. To restart:

```sh
cd /Users/habibsaleh/Documents/latent-studio
npm run dev
```

For browser reproduction (Chromium needs normal macOS process-launch permission outside the restricted shell sandbox):

```sh
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers \
node scripts/verify-relationships-all.mjs
```

## Learnability and remaining limits

The intention wording is understandable without numeric layout terminology, and the footer repeats its effect before committing. The artist still has several concepts to understand: Together versus immediate reading order, device scope, and remembering versus a one-off exploration. Defaults make the demonstrated pair quick, but a longer page with many similar writing excerpts needs better companion recognition. Current choice menus show labels/excerpts rather than thumbnails.

On phone, the intention form collapses after exploration and remains available through Edit intentions. A native alternative selector stays above the preview; Apply and Keep current remain available in the footer. The artwork paper is 358×400px in a 390×844 window, about 43.5% of that window's area. Large images and writing require scrolling inside the website, and the surrounding explorer can also scroll. This is a deliberate readability tradeoff, not a claim that the phone workflow is frictionless. The added contextual action/chips also consume dock space compared with v0.17.

This is a first image-plus-writing relationship proof. At most four works across affected adjacent sections are considered. Nonadjacent sections require manual sequencing; cross-section spatial regrouping still requires explicit Flow. Placement holds conservatively freeze an entire section and its index, so they may reject an arrangement a more capable solver could satisfy. There is no search over arbitrary free placement, multi-page constraint graph, automatic typography change, automatic cropping, continuous enforcement or AI service. Film relationships and broader density are deferred.

Readability filtering uses a rough character-width threshold and selected-pair geometry, not actual pixel contrast, semantic reading quality, full accessibility analysis or every intermediate viewport. Independent phone authorship is preserved. Safari/WebKit, VoiceOver, physical touch, CJK/IME, large libraries and broad direction/media/font combinations remain unverified. No latency or cold-load performance claim is made. The bundle warning remains. No publishing, domains, credentials, billing, native Ritual work or remote push was performed.
