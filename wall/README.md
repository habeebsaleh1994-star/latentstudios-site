# Latent Studio — artist editor & local backend foundation

Temporary product name. A working local artist website builder with ten implemented local starting directions: **Folio, Gallery, Cinema, Archive, Gazette, Horizon, Poster, Atelier, Journal, Montage**. This is the canonical development workspace for the next increment.

## Open and run

- **Editor:** http://127.0.0.1:5181/
- **Ten isolated artist studies:** http://127.0.0.1:5181/?examples=1
- **Default photographic study:** http://127.0.0.1:5181/?demo=mara

```sh
cd /Users/habibsaleh/Documents/latent-studio
npm run dev
```

The dev server is running on loopback port 5181. It does not restart automatically after reboot. If dependencies are absent, run `npm ci`. Verified with Node 25.4.0; Vite needs a supported recent Node release (22.12+). `npm run build` creates `dist`; after stopping dev, `npm run preview` serves it on the same port.

The earlier four-style version remains untouched at **5179**, in `../latent-studio-stage-two`; the first version is `../latent-studio`, on **5178**. Different ports and browser profiles have separate saves. No browser data was transferred automatically. Keep using 5179 for existing work until you explicitly export and import a backup into 5181.

## Relationship exploration — 0.18.0

In **Arrange**, select an image or writing and choose **Explore image + writing**. Explicit Together/Follows intentions guide rendered alternatives for desktop, phone or both. Originals, crop/focal values, typography and identity are kept. Intentions never silently rearrange the canvas; remember them only on Apply, or use them for this exploration alone. The previous arrangement becomes a study in the same Undo step.

Three distinct candidates are offered when the real content passes rendered checks; large type or conflicting placement holds can produce fewer, with an inline explanation. On phone, the form collapses behind Edit intentions and a compact alternative selector keeps the artwork accessible. Selected intention chips can be removed without moving works.

Document/backup **v13**, **318 tests / 36 backend cases**, lint, client/backend types and build pass. Actual Chromium workflows cover conflicts, unchanged source, touch Apply, Undo/Redo, studies, deletion, exact migration recovery and HTML/ZIP parity. An observed fixture used **4 actions versus 11** through the existing manual controls; this is not an artist usability study. [Working behavior, screenshots, measured walkthrough, verification and limits](docs/RELATIONSHIPS.md).

## Selection and readability — 0.17.0

The selected work now has one shared identity across the canvas, visual thumbnail/text picker and content inspector. **Reveal** temporarily uncovers it without changing saved layers. Spatial controls occupy one compact dock below the artwork, with direct handles and progressive Position, Layers, Caption, Reading and Section settings. Rounded number displays preserve exact stored values until edited.

Choose an actual **768px viewport** to inspect tablet wrapping independently of Fit/100% zoom. Nonblocking Readability notes flag potential text coverage, caption/image overlap and small captions. Explicit per-device caption position, backing and size preserve the words and travel with arrangements, studies, recovery and HTML/ZIP exports.

Document/backup **v12**, **298 tests / 36 backend**, lint, client/backend types and build pass. Browser verification includes the existing offending fixture, gestures, inspector/device selection, 90 rendered cases, 40 pixel-identical legacy defaults and five prior regression suites. [Screenshots, actual control/artwork area, architecture, verification and remaining UI limits](docs/SELECTION-READABILITY.md). Relationship exploration is added in v0.18; continuous relationship enforcement remains deferred.

## Optional spatial sections — 0.16.0

In **Arrange**, choose **Place freely** to position and resize image, writing and film within a section. Intentional overlap, independent layer/reading order, optional guides/snaps and precise keyboard controls preserve content, crops and typography. Width changes retain intrinsic height; sections grow to contain text, captions and media. Desktop and phone independently use placement or flow.

**Preview flow** opens protected A/B. Apply keeps a named spatial study and dormant geometry for **Resume placement**. Each gesture has one Undo; unfinished gestures cancel on Escape, blur or reload. **More** exposes precise values and layer/reading controls while the main rail stays small. Fit keeps physical 44px targets and readable numeric inputs.

Document/backup **v11**, **283 tests / 36 backend**, lint, client/backend types and build pass. Browser verification includes 90 rendered direction/page/width combinations, 40 pixel-identical archived-v10/current-v11 defaults, actual HTML/ZIP parity and the prior composition/typography regressions. [Implementation, screenshots, reproduction, measured responsiveness, visual critique and relationship-workflow groundwork](docs/SPATIAL-SECTIONS.md). Home covers and a relationship solver remain outside this milestone.

## Local typography and fine proportions — 0.15.0

Select writing and choose **Style this writing**, including in **Focus canvas**. Create named poem, statement or marginal-note styles, reuse them explicitly, and choose **This work** or **Named style · subscriber count** before editing. Font, size, leading, tracking, alignment, measure and preserved poem spacing support inherited defaults, local resets, Undo and deliberate **Phone only** overrides. Words remain shared across devices. **Global identity · all pages** remains a separate scope.

In **Arrange**, widths and column proportions now adjust continuously; arrow keys use 1%, Shift 5%, Option/Alt 0.1%. Desktop and phone geometry remain independent. Optional guides, studies, saves, releases and actual HTML/ZIP exports retain these choices without changing image crops.

Document/backup **v10** preserves inherited rendering and retains the exact pre-migration record on first mutation. **256 tests**, lint, client/backend types and build pass. Browser acceptance covers typography, actual keyboard line breaks/caret behavior, precise geometry, shared words, recovery and rendered HTML/ZIP parity; 40 archived-v9/current-v10 render comparisons were pixel-identical. [Behavior, screenshots, reproduction and limits](docs/LOCAL-EXPRESSION.md).

## Independent desktop and phone arrangements — 0.14.0

Desktop and phone now own independent group membership, order and geometry while sharing each authored work. In **Arrange**, select the device, then select, group, separate or move works. A different sequence on the other device cannot block grouping. Content edits remain shared; delete/duplicate controls state their scope across both devices. Studies keep both layouts, and alternatives affect the selected device.

Document/backup v9 migrates historical layouts without changing their render. First save retains the exact original as **Before independent device arrangements**. 225 tests, lint, client/backend types and build pass. Chromium verified desktop A+B / phone A,C,B, shared essay editing, phone touch regroup/Undo, studies, interrupted gestures and actual HTML/ZIP renders. Forty archived-v8/current-v9 render cases were pixel-identical. [Migration rules, evidence, reproduction and limits](docs/INDEPENDENT-VIEWPORTS.md).

The versioned milestone notes describe their original releases; v0.14 supersedes shared-group constraints, v0.15 adds work-level typography and fine geometry, v0.16 adds optional spatial placement, v0.17 unifies selection and adds explicit caption/readability controls, and v0.18 adds optional relationship exploration.

## Canvas focus & trustworthy comparison — 0.13.0

**Focus canvas**, a collapsible inspector and Fit/100% controls give the artwork more room. Selection actions move below the preview; 44px work/group controls sit in a rail above artwork. The confirmed hidden-draft mutation during study comparison is fixed at the document controller. Read-only A/B comparison uses matched scale and linked location; phones use a same-position toggle. Reading scale now states its direction-wide scope.

200 tests, lint, types and build pass, plus fresh focused browser acceptance and all three prior interaction/export suites. [Measured space gains, before/after screenshots, reproduction, evidence and remaining limits](docs/CANVAS-FOCUS.md).

## Direct work gestures — 0.12.0

In **Arrange**, drag a selected work's grip into a section to group, or between sections to move. Simple changes commit directly with one Undo; partial regrouping keeps its comparison. Conflicting reading orders refuse inline. Canvas controls retain 44px physical targets even in a scaled tablet desktop preview. Desktop and phone still share group boundaries.

196 tests, lint, client/backend types and build pass. The full acceptance path passes with keyboard, mouse and Chromium emulated touch; the prior canvas and grouping/export suites also pass. [Behavior, screenshots, evidence and remaining design constraints](docs/DIRECT-DRAG.md). Safari and physical devices were not tested for this increment.

## Direct grouping & responsive composition — 0.11.0

In **Arrange**, select artworks directly, Shift-select a range and review grouping or separation on desktop and mobile. Regroup across existing boundaries while locking both reading orders; conflicts explain why a grouping cannot be applied. **Try group arrangements** now offers device-specific alternatives, preserving the other device and all original content/crops. Named studies retain the resulting groups and mobile choices.

189 tests, lint, client/backend types and build pass. Actual browser checks include narrow phones, tablet touch, exact Undo, the earlier pointer/keyboard/touch suite and rendered standalone export parity. Free placement and overlap remain unimplemented. [Screenshots, verification and candid interaction critique](docs/DIRECT-GROUPING.md).

## Canvas studies — 0.10.0

On a content page, choose **Arrange** to move groups, resize to width guides and adjust spacing directly on the canvas. **Try arrangements** previews three real compositions of the same selected works. **Composition studies** keeps named arrangements, compares them without editing the draft and applies one while retaining the displaced arrangement. Words, files, crops and mobile decisions remain attached to the original works.

174 tests, lint, client/backend types and build pass. Actual browser checks cover pointer, keyboard and emulated touch, interrupted edits, exact Undo, and 360/390/768/1440px layouts. Desktop preview retains desktop geometry when scaled in a narrow editor. [Full behavior, screenshots, test evidence and limits](docs/CANVAS-STUDIES.md). This is a local composition milestone; no hosting or publishing was performed.

## Review this milestone

The six new studies start with their direction’s original layout: Gazette magazine hierarchy, Horizon horizontal filmstrip, Poster large type, Atelier split case studies, Journal intimate reading and Montage asymmetric image/text placement. Shared composition remains an explicit option. [Ten-direction evidence](docs/VERIFICATION.md).

1. Open **Artist studies**. Fresh demo studios include authored image/text, image-pair, writing, and mixed-media arrangements. Existing saved studios keep their current work. Mara, Sora, Noor, Ivo, Elena, Kai, Ada, Common Form, Lina and Rémy each open a separate, persistent demo studio. They are fictional coverage examples, not user research. They do not overwrite the main draft or each other.
2. In **Edit** mode, click a title, name, introduction, caption, or writing and type directly. Matching contextual controls appear in the sidebar. Select a photo/film to reach its actual block inspector. Escape ends text selection; Undo/Redo include direct edits.
3. Open **Identity** to shape typefaces, scale, weight, tracking, reading rhythm, canvas/text/accent colors, margins, work spacing, image scale, and title alignment. Choices apply across every page of the active direction. Switching direction preserves its independent identity. **Use this identity across all ten** is an explicit, undoable replacement.
4. Try a low-contrast color. The editor explains the problem and offers a correction; it keeps your choice until you act. These checks cover solid canvas/text pairs, not a complete accessibility audit.
5. **Browse** restores normal links and native film controls. **Mobile preview** uses a true 390px viewport. **View site** opens the rendered site with the same saved content.
6. On a project, writing, or about page, choose **Arrange this page**. Group 2–4 adjacent works; choose stack/equal/weighted columns, width, alignment and spacing. Select **Mobile layout** for independent groups, section/work order, stacking, width and spacing. The preview changes with the controls. Duplicate, remove, ungroup and reorder all support Undo. **Use direction’s original layout** retains the arrangement for later; its sequence stays managed through the arrangement panel.
7. **Draft tools → Export backup → Copy backup JSON** supplies a portable version-twelve document. Save it as a `.json` file; **Restore backup** accepts versions one through twelve. A backup download link is also provided; completed native download receipt is not yet verified.

Editing main content remains shared across styles. Local image/film uploads, page/block sequencing, navigation settings, image crops/focal points, queued saves, stale-window protection, and recovery records remain in place. Folio opening/closing words and Cinema programme copy are now editable too. Undo history is session-local and ends at reload.

## Bring a Story from Ritual

Use **Draft tools → Bring a Story from Ritual…**. Select the native synthetic package in `tests/fixtures/ritual-story-publication.zip`, review desktop/mobile interpretation, enter an artist name and confirm creation of a **separate** local draft. The actual `LatentSequence` adapter produced this fixture; no artist library was used. [Implementation and verification limits](docs/RITUAL-BRIDGE.md) · [Synthetic exported website](docs/evidence/ritual-bridge/native-story.html).

## Local release and recovery

Use **Release & recovery** in the header. Add publication details, run **Review draft**, name an edition and choose **Create local release**. The release is frozen while you keep editing; it is not published or shareable. **Prepare web images** creates reviewed display copies without replacing originals. Choose originals or prepared web copies, then **Prepare website folder · ZIP** for relative responsive media, or **Prepare single HTML file** for one embedded edition. Editable backups retain original files.

**Revisions & recovery** keeps named checkpoints, shows document comparisons and responsive previews, and restores as a new draft while preserving the replaced draft. **Restore a backup** accepts pasted JSON as well as the existing file-import workflow. Versions 1–12 migrate without replacing their source record on read; the first save retains the exact pre-migration record. Current backups are version 13.

Useful review artifacts: [Sora's exported website](docs/evidence/sora-local-release.html) and [Ivo's film website](docs/evidence/ivo-local-release.html). These are fictional samples generated through the actual browser UI; open the HTML files locally or serve this directory. They are complete exported editions, not live sites.

## Boundaries and next increment

Ten implemented local starting directions with distinct home/project/reading layouts and complete local editing/export support. These are not a production-launch or hosting claim. No publishing, accounts, cloud storage, domains, subdomains, billing, remote integrations, or production hosting. No user's artwork is included or published.

The [publishing foundation](docs/PUBLISHING-FOUNDATION.md) and local image delivery are implemented. The [Ritual Story bridge](docs/RITUAL-BRIDGE.md) now includes a real native exporter and reviewed import into a separate draft; live browser import/edit/restore/release and desktop/mobile export checks now pass. Native-panel interaction remains blocked by the locked Mac. A real SQLite backend contract and tenant-isolation harness is now implemented separately from the editor; [production decisions](docs/PRODUCTION-DECISIONS.md) remain pending. Keep using this workbench and port.

[Verification and screenshots](docs/VERIFICATION.md) · [Architecture and recovery](docs/ARCHITECTURE.md) · [Media provenance](docs/MEDIA.md)

## Image delivery review

Use the Mara study → Release & recovery → current local release → Prepare web images. Review original/web-copy previews, then generate a folder ZIP. Originals are immutable; crops and focal points remain editable layout choices. The cache makes 640/1280/2400px long-edge WebP copies only when smaller, without enlarging. Animated files, vectors and films stay original. A multi-size ZIP may be larger overall while individual page requests become smaller. See [measured verification](docs/VERIFICATION.md) and the ten browser-generated folder and embedded exports there.

## Local backend foundation (0.7.0)

`npm run backend:demo` runs a real SQLite/filesystem scenario with fictional owners, a real decoded licensed photo, domain rejection, publication, reopen/recovery and rollback. It starts no server and opens no accounts. Fixture authentication and domain proof are explicitly simulated; the generated private data manifest is not a hosted website. JPEG/PNG are the initial backend admission scope. The editor, originals, backups and styles remain separate from this backend.

`npm test` includes 36 backend cases (318 total). `npm run build` type-checks both environments. This local backend requires the tested Node 25.4 SQLite support and macOS ImageIO for the current image inspector. [Backend design and provider gaps](docs/BACKEND-FOUNDATION.md) · [Scenario report](docs/evidence/backend-demo-latest.json). Private fixture databases/files live in OS temporary storage outside the browser-served tree; no browser draft is moved there automatically.

Dependency maintenance: Vitest 4.1.11 is installed; all 160 tests, lint, types/build and browser smoke checks pass, with zero known npm audit vulnerabilities. [Exact scope and remaining warnings](docs/DEPENDENCY-MAINTENANCE.md).
