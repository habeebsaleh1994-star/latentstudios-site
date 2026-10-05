# Local typography and fine proportions — 0.15.0

## Ownership and migration invariants

- One shared block record owns text and typography assignment. Source words, capitalization, line breaks, media, captions, crops and focal point are never transformed by presentation. Poem presentation preserves indentation and deliberate newlines, with wrapping allowed on narrow screens.
- Site identity is the inherited baseline. A reusable named text style contains a role, base overrides and optional phone overrides. Only explicitly subscribed text blocks use it. A text block may add its own base and phone overrides. Per-property precedence is identity → named base → named phone (on phone) → work base → work phone. Blank settings inherit; resets remove declarations rather than capturing the current computed appearance.
- Controls name their scope: this work or the named style and its subscriber count; all devices or phone only. Editing a named style cannot modify unsubscribed work records. Resetting a local layer retains its named style assignment; resetting the work to site identity removes assignment and all local declarations. All changes participate in normal Undo.
- Typography travels with live authored blocks. Composition studies retain both viewport geometries, including fine width and column ratio, and deliberately retain CURRENT text, style library, assignment and typography overrides on apply. Immutable releases freeze the complete document; editable backups carry all fields.
- v10 adds optional block typography, a named-style library, optional precise width percentage and optional first-column ratio per viewport group. Absent fields preserve v9 rendering exactly. Legacy categorical width/layout remains the fallback; explicit fine values override only their geometry. Layout proposals and preset selection explicitly clear the corresponding fine override. No resize edits source crop/fit/focal values.
- First mutation of a pre-v10 stored document atomically preserves its exact record as `pre-local-expression`. Historical backup/recovery/release reads normalize in memory, never rewriting original records. Invalid style references, duplicate style IDs/names, invalid ranges and unsupported typography/geometry fields reject rather than silently falling back.
- Existing system font families only; no upload, font download, redistribution or new credentials. Accessibility advice is descriptive and never changes an artist’s authored values.

## Implemented behavior

The invariants above were written before implementation. Select a writing block in Edit, then **Style this writing**. The same controls appear in the contextual inspector. The dialog works inside Focus canvas and returns to it on Escape. Font family, size and leading are immediately available; spacing, alignment and line breaks are disclosed on demand. The active work/style and device scopes are stated above the controls. Named style assignment is explicit, subscribers are counted across pages, and name/role changes preserve declarations and subscribers. Changing a role after creation does not replace the artist’s typography.

The four existing system stacks are Literary serif, Clear sans, Book humanist and Studio mono. The initial poem, statement and marginal-note presets are editable named styles, not text conversions. Blank fields inherit. Phone presentation never creates a second text record. Named styles and local declarations follow works across visual directions; global identity remains direction-specific. Headings, captions and site copy continue to use their existing identity controls.

In Arrange, a group’s precise width is 25–100% and its first-column share is 20–80%. Pointer/touch adjustments round to 0.1%; arrows use 1%, Shift 5%, Option/Alt 0.1%. Width Home/End uses 25/100%; column Home/End uses 20/80%. Escape cancels a live gesture. Each device owns these values. A width or layout preset clears its corresponding fine override explicitly. The Guides toggle is transient editor state. Arrangement studies capture both geometries and retain the current words and typography on Apply.

The shared renderer resolves named/local/device typography for the editor, study previews and public exports. The v10 schema validates references, unique names/IDs, ranges and supported fields before migration can normalize anything. The backend checks the raw historical shape too. Save, backup replacement and recovery restore retain the exact pre-v10 record atomically as **Before local typography and fine proportions**. Releases remain immutable; reading/exporting historical releases normalizes in memory only.

### Source-text corrections found by browser testing

Chromium’s editable DOM exposed two real problems: `innerText` inserted extra blank lines between browser-generated paragraphs, and native Enter appended an extra terminal newline as a caret scaffold. Saving `textContent` alone would lose paragraph breaks instead. The editor now reads line structure, handles authored line insertion/selected deletion before browser scaffolding, and normalizes wrappers while preserving the caret. A terminal BR provides the visual caret line without becoming saved source text. IME normalization is deferred until composition ends. CSS capitalization never becomes manuscript text.

## Verification and evidence

- **256 tests / 16 files**, including **35 actual SQLite backend cases**. Coverage includes inherited rendering declarations, named subscribers, override precedence/reset, phone source sharing, history, geometry, studies, exact original recovery, stale writers, backups, immutable release export, malformed input rejection, and SQLite reopen/history restore/frozen releases. [Test output](evidence/local-expression/tests.txt).
- **Client/backend types, lint and production build passed.** [Build](evidence/local-expression/build.txt), [lint](evidence/local-expression/lint.txt). Existing warnings remain: Node SQLite is experimental; Rollup strips two Zod comment annotations; the editor bundle is 644.75 kB minified and portable runtime 396.00 kB. No dependency was added.
- **Actual authoring acceptance in isolated Chromium 145.0.7632.6:** created three named roles, subscribed a second poem, changed only the two subscribers, applied/reset local declarations, checked advisory warnings and exact Undo, edited shared lowercase poem text on phone, changed global identity without rewriting explicit type, and edited through Poster without source capitalization. [Results](evidence/local-expression/browser-results.json), [writing controls](evidence/local-expression/phone-type-controls.png).
- **Fine geometry:** desktop 85.9% width with 56.1:43.9 columns; phone 98.9% with 48.9:51.1 columns. Emulated touch adjustment, exact Undo, interrupted keyboard gesture, Guides toggle, reload and 44px canvas controls at 390/768/1440px passed. Study Apply restored both precise layouts while retaining the latest manuscript, style library and phone typography. [Canvas screenshot](evidence/local-expression/desktop-fine-proportions.png).
- **Native text editing:** Enter, Shift-Enter, multiple/terminal blank lines, mid-line caret insertion, selection replacement, Backspace line joining, select-all deletion, repeated replacement, document Undo and reload preserve exact text. [Keyboard results](evidence/local-expression/plaintext-browser-results.json). These tests include actual Chromium keyboard events, beyond programmatic fill.
- **Phone writing controls at actual 390px width:** multi-digit size and decimal leading entry, named-style rename/role with unchanged declarations/subscribers, device switching, Tab containment, Escape back to Focus canvas, no horizontal overflow, and 44px close/history targets. Device switching originally remounted the preview and let selected text steal focus; the canvas now suspends text editing while its style dialog owns focus. [Control results](evidence/local-expression/type-controls-browser-results.json), [phone dialog screenshot](evidence/local-expression/phone-type-controls-390.png).
- **Actual export parity:** standalone HTML and extracted ZIP both render at 390/1440 with exact source breaks/case, named/local/device styles, geometry, decoded media and 23%/72% image focal point. Phone poem uses 19px mono / 36.1px leading; desktop uses 29px Book humanist / 47.85px leading. Private studies/editor controls are absent. [HTML](evidence/local-expression/artist-typography.html), [ZIP](evidence/local-expression/artist-typography.zip), [editable v10 backup](evidence/local-expression/editable-backup.json), [desktop](evidence/local-expression/standalone.html-1440.png), [phone](evidence/local-expression/standalone.html-390.png).
- **Legacy visual migration:** archived v0.14/v9 versus current v10. All **40 cases were pixel-identical**: ten directions × desktop/phone × enabled/disabled arrangement. Geometry and work order matched too. [Hashes and results](evidence/local-expression/migration/browser-results.json), [v9 phone](evidence/local-expression/migration/v9-390.png), [v10 phone](evidence/local-expression/migration/v10-390.png).
- **Existing regression flows:** independent desktop A+B / phone A,C,B, shared writing, touch grouping, Undo, interrupted gestures, saved studies, read-only A/B, displaced arrangements and actual export parity; focused canvas, Fit/100%, matched comparison scale/linked location, hidden/late mutation blocking and reload. [Independent results](evidence/local-expression/independent-regression/browser-results.json), [focus results](evidence/local-expression/focus-regression/browser-results.json).

## Review and reproduce

Canonical project: `/Users/habibsaleh/Documents/latent-studio`. Open **http://127.0.0.1:5181/**; run `npm run dev` if the loopback server has stopped. Other projects and real browser drafts were untouched. The source before this milestone is preserved in [pre-local-expression-v0.14.0.tar.gz](recovery/pre-local-expression-v0.14.0.tar.gz).

Every browser script uses a fresh isolated context and UUID workspace, refuses an existing saved draft and uses fictional text/original synthetic geometric media. The control-size check reuses only the synthetic exported backup. No user artwork or credentials were read into these fixtures.

```sh
npm test
npm run lint
npm run build
export LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs
export PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers
node scripts/verify-local-expression-browser.mjs
node scripts/verify-plaintext-browser.mjs
node scripts/verify-type-controls-browser.mjs
node scripts/verify-independent-viewports-browser.mjs
node scripts/verify-canvas-focus-browser.mjs
```

`verify-type-controls-browser.mjs` requires the synthetic backup generated by the main typography acceptance script. The three older canvas/grouping/drag entrypoints are aliases to the consolidated independent-viewport suite, not three independent new passes. The legacy comparison additionally needs archived v0.14 `src` served on 5193 with the current Vite config/index/package and links to installed dependencies/public assets; run `verify-local-expression-migration-browser.mjs`. This baseline was served from OS temporary storage, never restored over this project.

Safari/WebKit, physical devices and IME language input were not exercised; touch is Chromium emulation. There is no claim of a full accessibility audit. Rich inline formatting, custom font upload/licensing, named-style deletion/library management, arbitrary spatial placement/overlap and production hosting remain deferred. Undo is session-local. Generated file contents and local rendered exports were verified; native download receipt was not exercised. No publishing, external accounts, domain/billing changes, remote pushes or Ritual project changes were made for this milestone.
