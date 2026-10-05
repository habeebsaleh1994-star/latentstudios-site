# Architecture — document version eight

## Content and presentation

`model.ts` owns runtime validation. Stable page/block IDs and ordered arrays own content identity and sequence. Pages contain image, text, and video blocks; navigation visibility/labels are separate from titles. React renders plain text, never authored HTML. Limits remain 50 pages and 100 blocks per page with unique IDs and one home.

Version three added per-direction `identity` settings and authored composition `copy`. `siteSchema` accepts v1 through v7 and supplies defaults without changing previous text, page/block IDs, ordering, navigation, media, crops, focal points, or per-style appearance. A style's prior theme/type options remain available through migration and supply the direction-default values.

`identity.ts` resolves nullable custom tokens against style defaults. `identity.css` applies them across all renderers. System fonts avoid external requests. Each direction remains an authored composition: Cinema keeps a full-bleed shaded cover and white cover text; custom canvas colors and image scale govern its reading/programme/screens. Mobile margins ease to at most 6vw. The UI explains these responsive/directional constraints.

Folio is an editorial sequence, Gallery an exhibition room, Cinema a programme and screening sequence, Archive a searchable index and contact sheet. The same renderer/CSS drives editor iframe and standalone website. All ten directions are implemented. `NewDirections.tsx` provides Gazette, Horizon, Poster, Atelier, Journal and Montage, with shared source/editing contracts and separate compositional systems.

## Composition and mobile art direction

Version four adds nullable `page.composition`. Null preserves the previous rendering. Enabling composition creates sections that partition the page’s original block array exactly once, in source order. Each section references 1–4 stable block IDs; it does not own duplicate text or media. Schema validation rejects missing/duplicated/noncanonical references and invalid mobile order. An enabled flag switches presentation without discarding the arrangement.

`composition.ts` owns group/ungroup, section/member move, duplicate, remove, and add/remove reconciliation. Grouping is adjacent-only, up to four works, with the new defaults explained by the control. Duplication allocates fresh IDs and shares immutable original media references. All operations are immutable functions and use the existing history/revision/save queue. Source block order is updated to follow desktop sections; an explicit mobile section permutation remains independent. Ungroup preserves a reversed group’s mobile reading order. Disabled saved arrangements still own sequence; old individual move controls are disabled with a route back to the arrangement panel.

`CompositionSections.tsx` renders the same optional scrolling composition inside all ten direction shells, keeping original typography, header, navigation, and footer. Gallery/Cinema/Archive original viewers return when composition is disabled. Homepages stay direction-specific. `CompositionPanel.tsx` uses keyboard-accessible selection, grouping checkboxes, move buttons, layout fields, and explicit structural actions. Direct text/media editing uses the existing source targets.

At 640px and below, a media query attached to the iframe’s own window chooses the authored mobile section/member order. DOM order follows the visible order for keyboard and reading flow. CSS grid handles stack/equal/weighted columns without imposing any image crop. Width, gap and space-before can differ on mobile; alignment/vertical alignment are shared. Original media proportions, explicit crop/focal settings, and site-wide media/type identity remain active. No nesting or third tablet mode.

The first four fresh fictional demo stores seed authored arrangements; the six new studies start in their original direction layouts. Existing stores are never reset or overwritten by sample factory updates. The source snapshot before this change is `docs/recovery/pre-composition-source-v0.3.0.tar.gz`; it is not a browser-data rollback mechanism.

## Direct editing

`editing.tsx` defines stable text/media selection targets. Updates always resolve against the latest document; missing targets are never recreated. `EditableText` retains the original heading/paragraph structure. In Edit mode, keyboard/click selection enables plain-text contenteditable and contextual controls. It updates DOM text only when different from the model, avoiding caret resets on each keystroke. Field limits match schema limits. Escape clears selection; Cmd/Ctrl-Z and Shift-Z use the same authoritative history as the sidebar. Media selection routes to its owning page/block inspector. Browse mode removes editable semantics and enables normal film controls.

`ContextPanel.tsx` is an alternate editor for the same field, not a second source. Type controls clearly identify their site-wide scope. `IdentityPanel.tsx` offers expressive controls and explicit contrast suggestions. No authored colors or words are automatically rewritten. Contrast guidance uses the WCAG luminance formula for solid text/canvas pairs, not image overlays or complete-page accessibility certification.

## Durability and recovery

`history.ts` groups same-field typing within 1.2 seconds; blur, navigation, selection changes, and structural operations establish boundaries. `SaveQueue.ts` serializes/coalesces writes and retains the newest pending edit after failure. IndexedDB transactions check expected revisions. Stale editors receive a warning and cannot overwrite newer saved work; read-only previews refresh through BroadcastChannel.

Uploads capture owning page/block IDs, media type, and previous asset ID before the chooser opens. Completion resolves against the latest document and refuses deleted/replaced targets. Image decoding and film metadata are validated; object URLs are revoked. This milestone retains those contracts.

Reading old records is nondestructive. First migrated saves retain exact originals as `pre-edition-two`, `pre-identity-system`, and/or `pre-composition-system` as applicable. Older versions are read without rewriting the saved record. Restore validates first, waits for outstanding saves, writes atomically, retains `before-restore`, and clears undo only on success. Imported asset-ID collisions are remapped; prior blobs remain available. The later publication milestone adds a recovery history browser; portable backups remain necessary for protection from browser storage loss.

`workspace.ts` gives the main draft database `latent-studio-v1`, and the allowlisted `?demo=mara|sora|noor|ivo` studios their own `latent-studio-demo-*` databases and matching channel namespaces. Switching studios uses full navigation; all in-studio links retain its query scope. `samples.ts` supplies independent cloned documents. No sample loader can overwrite the main draft. Origin separation also protects the earlier 5178/5179 versions; transfer requires explicit backup import.

## Remaining boundary

No service endpoints, credentials, domains, accounts, hosting, payments, integrations, or remote processing. Existing Moment/Field infrastructure, websites, and earlier project folders are untouched.

Implemented: the [local publishing foundation](PUBLISHING-FOUNDATION.md): immutable revisions, recovery, draft/local-release snapshots, preflight, portable static export, and media/storage contracts. External provisioning remains separately authorized. Before production: cross-browser/physical-device testing, full accessibility work, fonts/media optimization, quota and recovery UI, asset lifecycle, persistent version history, SEO/export contracts, and cloud durability. A forced process exit can lose unfinished saves; session undo does not survive reload.


## Local publication and recovery boundary (0.5.0)

Version 5 adds publication metadata and migrates versions 1–4 in memory. `pre-publication-system` retains the exact older record on first save. `storage.ts` supplies draft/media repository ports and atomic transaction failure handling; `revisions.ts` supplies the immutable revision repository. Revision envelopes use format version 1 and live under unique `revision:` keys in the existing documents store, so the IndexedDB schema itself does not need a blocking version upgrade. `local-release` is a separately checked pointer, never a mutable copy of the draft.

A checkpoint captures original media blobs inside its own record. Restoration adds a checkpoint for the outgoing draft and writes the restored document/media in one transaction. All restored media receive fresh IDs, including bundled demo originals, so future changes to bundled files cannot change a restored draft. Known demo provenance survives the ID remap. Backup imports preserve uniquely keyed pre-import records and remap collisions. Original blobs are not garbage-collected.

`ReleasePanel` uses a native modal dialog, a single operation boundary and `useStudio.withSaved` to wait for the serial queue before release/recovery actions. No snapshot may silently omit an unsaved edit or overwrite a stale draft. `preflight.ts` performs bounded, serial media checks; content observations are in `publication.ts`. Differences are structural, including media references, not pixel-equivalence claims.

`MediaSources` supplies frozen blob URLs to revision previews and embedded data URLs to portable output. It bypasses IndexedDB when supplied. Vite bundles a dedicated read-only `export-entry.tsx` runtime into a lazy export module. `portable.ts` escapes HTML metadata and JSON script boundaries, embeds all release assets and records routes. Exported navigation remains inside the output file, including new-tab links. The editable backup is a document/media package, not a full revision-library export.

Future adapters must preserve these contracts; see `PUBLISHING-FOUNDATION.md` for retained limitations and production decisions. No server/authentication or remote publication adapter currently exists.

## Local media delivery boundary (0.6.0)

`mediaDelivery.ts` owns separate rebuildable `latent-studio-display-cache-v1` records keyed by SHA-256(original) + `srgb-webp-q88-longedge-v1`. No draft schema or asset-store upgrade. It decodes EXIF orientation, draws the whole image into sRGB alpha canvases, and retains smaller WebP copies at 640/1280/2400px long edges without upscaling. Animation/vector/film passthrough is explicit. 15-second decode timeout, cancellation and bitmap cleanup bound work; the 32MP cutoff follows decode. No automated cache pruning, color-proofing or adaptive video.

`MediaSources` can provide either plain URLs or a responsive source object. `Media` measures its actual slot with ResizeObserver, then supplies width-descriptor srcset/sizes, intrinsic proportions, lazy loading, async decode and authored CSS crop/focal position. A ratio-preserving empty placeholder prevents fetching a large candidate before slot measurement. The editor retains originals; frozen release previews can opt into cached copies and fall back to originals. Object URLs are revoked.

`portablePackage` creates a bounded stored ZIP with index.html, relative content-addressed media, delivery.json provenance/byte receipt and instructions. Responsive copies avoid embedded base64 and permit per-viewport selection. `portableHTML` remains an alternative, embedding one largest selected copy per asset. Neither changes the frozen originals or editable backups. Package size can exceed original-media size because it includes several candidates. `zip.ts` checks paths, duplicates, entry count and 120MB size before writing CRC/central-directory structures.

The read-only runtime no longer imports validator/seeding/draft modules: `database.ts`, `mediaRepository.ts`, `mediaDefinitions.ts`, `sampleIds.ts` and `ids.ts` establish narrow dependencies; content-model references in renderers are type-only. Portable envelope v2 supports relative responsive sources. Export documents are validated before generation. No remotely supplied runtime/document importer is exposed.

## Separate local backend (0.7.0)

`backend/contracts.ts` and `StudioService` define owner-authorized service operations, storage, inspector, verifier and publisher boundaries. `SqliteRepository` implements real schema migrations, composite tenant/site constraints, draft history, immutable releases, domain proof state and transactional publication generations. `PrivateFiles` and `ManifestPublisher` hold original/approved artifact bytes in private OS temporary directories for tests and the CLI scenario. No backend module is imported by the UI, and there is no network listener or authentication implementation.

The CLI/tests inject synthetic principals and DNS proof. The publisher prepares data/manifests and separate original media, not the existing renderer's HTML. These are explicit integration gaps, alongside Postgres RLS and remote object/hosting adapters. [Exact implementation and gaps](BACKEND-FOUNDATION.md). Existing browser storage/revisions remain authoritative for the artist editor.

## Ten-direction document boundary (0.8.0)

Document v6 expands the per-style appearance record from four to ten without changing any content or existing identities. Versions 1–5 migrate in memory. The first changed save retains the exact older saved record as `pre-ten-directions`; recovery exposes it as “Before ten directions.” Backup envelopes now use v6 and accept v1–v6. Existing immutable revision envelopes remain v1 and their embedded site migrates on read. The local backend validation admits known v5/v6 documents; its database migrations and provider gaps are unchanged.

Gazette has issue/lead/contents and split editorial pages; Horizon uses a native desktop rail with buttons and arrow keys, becoming an ordinary complete vertical mobile sequence; Poster uses typography-led billboards; Atelier uses a studio index and split case studies; Journal uses marginalia and centered reading measures; Montage uses asymmetric, non-overlapping grid placement. Block order is always the authored sequence. The optional shared composition deliberately supersedes a direction’s native viewer and is reversible.

Every renderer uses the same original sources, explicit crop/focal data, identity tokens, editable targets, composition sections and export runtime. No external font/motion dependency was introduced. Direct text editing temporarily removes text-transform while selected, preventing display casing from entering saved text through browser innerText.

The dev-only `tests/browser/directions.html` generates synthetic frozen revisions using the real media/export functions and exposes export bytes for browser-assisted verification. It is not included in `dist`, has no external side effects and never reads/writes artist drafts. Source recovery: `docs/recovery/pre-ten-styles-source-v0.7.0.tar.gz`.

## Ritual publication boundary (0.9.0)

`ritualContract.ts` defines the public v1 allowlist. `ritualArchive.ts` validates bounded stored ZIPs, exact manifest fields and metadata-free PNGs before browser decode. `RitualImportPanel` previews the actual website renderer before approval. `ritualImport.ts` builds a fresh website document and atomically writes a separate Story database; it never calls the current-draft repository to replace content. Document v7 retains immutable original public provenance. Main/demo databases and channels are unchanged; Story links carry `?studio=<UUID>`. Registry-write failure after successful creation yields a direct recovery link. See [contract and evidence](RITUAL-BRIDGE.md).


## Canvas studies boundary (0.10.0)

Document v8 adds optional `Page.studies` with unique study IDs, names, timestamps, block ID order and a nullable composition snapshot. Study validation permits references to since-removed works; applying uses current blocks and reconciles additions/removals. `compositionStudies.ts` owns these operations and selected-section proposals. No media or authored words are copied into studies. The exact v7 record is retained at `pre-canvas-studies` on first migrated write.

`CanvasArrangement.tsx` keeps drag/keyboard preview state outside the document and commits one operation on completion. The autoscroll animation loop runs only while a pointer reorder is active. `CompositionSections.tsx` renders actual device geometry and local controls. `CanvasStudies.tsx` renders named comparisons and three actual group miniatures. `App.tsx` derives a comparison site without mutating the draft and makes the sidebar inert during comparison. `PreviewFrame.tsx` preserves a minimum 1024px desktop viewport by scaling its iframe on narrow editors, while mobile previews use their actual width.

Editable backups use v8 and preserve studies. Both portable formats and the independent local backend artifact serialize `publicWebsite(site)`, which removes private studies while retaining the chosen geometry. The backend's verified artifact hash uses that public serialization; private draft/release records retain their original full-document hash and studies. No backend schema change or editor/backend connection was introduced. [Behavior, evidence and limits](CANVAS-STUDIES.md).


## Direct grouping boundary (0.11.0)

`regrouping.ts` is the single policy owner for direct and section-level grouping. It partitions existing sections around the chosen contiguous works, derives mobile group direction from the existing complete mobile sequence and rejects any result requiring an unrequested reorder. `compositionOrder.ts` contains the shared ordered-section/block helpers; `composition.ts` delegates its grouping APIs to the same policy. Selected work IDs live in App state and survive geometry mutations without entering the document.

`CanvasGrouping.tsx` presents work actions and a read-only current/proposed review with reading-order/crop locks. The fitted overview is explicitly separate from full-width inspection. `CompositionSections.tsx` makes work surfaces and accessible work controls selectable in Arrange mode. `CanvasStudies.tsx` offers explicit desktop/mobile alternatives; one-work mobile sections omit the redundant two-column option. These operations use existing v8 fields, so no new migration or source-media duplication was introduced.

Inspector scrolling no longer scrolls the main phone page, and the canvas toolbar's action dimensions remain stable across selection, preventing an incidental iframe resize from cancelling a gesture. [Evidence and remaining constraints](DIRECT-GROUPING.md).

## Direct work gestures — 0.12.0

`workDrop.ts` is the pure intent boundary for into-section versus between-section drops. Into drops delegate to `planGrouping` and identify partial-companion restructuring that needs review. Between drops accept complete selected sections, preserve section geometry and block identities, and change only the explicit device sequence. `CanvasWorkDrag.tsx` owns transient pointer/keyboard targets, capture, cancellation, autoscroll and one release-time transaction. It never writes a transient preview to the document. Selection remains a set of block IDs independent of section identities.

`PreviewFrame` supplies an inverse CSS scale only to editor controls, retaining actual touch dimensions when the desktop canvas is scaled; document geometry and public rendering stay unchanged. Toolbar direct actions and drag gestures share grouping policy; invalid direct actions remain inline. The schema remains v8. Independent phone group membership requires a coordinated migration across validation, reconciliation, studies and export; see `DIRECT-DRAG.md`.

## Canvas focus and comparison — 0.13.0

`useStudio(readOnly, comparison)` gates ordinary document mutations, history operations, restore and saved-document actions with the current lock. `applyArrangementStudy` is a named explicit transaction that alone can apply the selected study during comparison; it retains the displaced arrangement and current content. App entry guards invalidate file targets and refuse late input callbacks. Hidden/inert inspector controls are a visible boundary, not the sole protection.

`StudyComparison` renders the same `SiteRenderer` twice under a null editing context. `PreviewFrame` owns Fit/100% viewport scaling. `previewPosition` maps stable composition block IDs plus relative offsets between panes; original non-arranged directions fall back to page progress. Restores use instant scroll to avoid a feedback loop with authored smooth scrolling. The active pane leads synchronization, with image-load/resize restoration, eager comparison media, same-position phone toggling, synchronized horizontal inspection and comparison-only trailing scroll space. Public rendering retains normal lazy media loading.

`canvas-focus.css` owns the editor workspace layout, inspector visibility and comparison panels. Composition controls now occupy a scrollable rail outside artwork. Arrange adds a minimum editor gutter only; comparison, Browse and exports do not. Focus/inspector/zoom are transient UI state. No document schema change or per-block typography was introduced.
