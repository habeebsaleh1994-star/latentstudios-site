# Identity & direct editing verification — 2026-10-04 UTC

## Current review

**http://127.0.0.1:5181/** — editor. **http://127.0.0.1:5181/?examples=1** — four separate fictional studios. Workspace: `latent-studio-workbench`. Version 0.3.0 / document version 3.

The 5179 four-style project and user's Safari session were left untouched. This milestone uses a separate origin and isolated in-app-browser QA storage. Sample stores are separate from the main 5181 draft and one another; no user browser data was copied or reset. The main QA draft retains deliberate typography/title/spacing changes from verification; each sample's initial identity remains available separately.

## Automated result

Final `npm run format`, `npm run lint`, `npm test`, and `npm run build` passed. The build runs `tsc -b`, so TypeScript checking passed too. **34 tests across three files**:

- `storage.test.ts`: 10 retained storage/document/import/media tests.
- `edition-two.test.ts`: 11 retained tests for full authored-content migration, nondestructive reads, exact recovery copies, v1 import, four-style preservation, grouped history, slow/coalesced saves, failure recovery, atomic restore, and asset collision remapping. Expectations were advanced to v3 while retaining old-content assertions.
- `identity.test.ts`: 13 tests for v2→v3 preservation, exact pre-identity record, v3 backup roundtrip, invalid identity rejection, stable direct-edit targets, deleted-target handling, authored composition copy, explicit apply-all plus undo, database/channel isolation, independent sample factories, four distinct artist documents, palette contrast, and retention of low-contrast authored colors.

Production output: CSS 61.42 kB (12.84 kB gzip), JS 455.16 kB (133.97 kB gzip). Two upstream Zod annotation warnings are stripped by Rollup; no application compilation errors. The built bundle was served temporarily on 5182 and exercised in the actual browser, then that server/tab was stopped. Dev server 5181 remains running.

## Actual browser evidence

Connected Mac, in-app browser. All four standalone artist homepages inspected at **1440×960** and **390×844**. All four mobile document widths measured 390px, with no horizontal overflow. The production editor was also exercised with its 390px mobile iframe.

| Flow | Observed result |
|---|---|
| Inline title | Clicked rendered title, replaced it with multiline text, continued typing; sidebar and canvas matched. Cmd-Z restored original wording; Cmd-Shift-Z restored the complete edit. Reload retained it. |
| Writing and caret | Enter selected Noor's writing with the keyboard. Multiline replacement and insertion into the middle of text stayed synchronized without moving new characters to the end. Grouped undo restored the original complete poem. |
| Focus/Escape | Selected writing retained keyboard focus and a visible 2px solid outline. Escape ended selection and returned page controls. |
| Media selection | Clicking a homepage photo selected its actual owning project and block, exposing the existing crop/caption/focal inspector. |
| Typography/proportion | Custom mono heading rendered in the actual iframe; 12vw margins and 60% image scale matched measured CSS/layout. Switching styles retained independent choices. |
| Apply to all | Explicit action applied the identity; Undo restored the prior independent identities. Switching Gallery/Folio confirmed each retained its own font. |
| Color guidance | White canvas / #eeeeee text retained the selected low-contrast color and reported 1.2:1. Explicit correction changed text to #202420 and reported 15.7:1. |
| Separate demos | Edited Sora's displayed name while the main draft remained Mara and “Saved on this device”; no cross-studio stale warning. Undo restored Sora. URLs retained the correct demo namespace. |
| Gallery mobile | Original geometric art, title wrapping, project room and third text entry rendered correctly. Navigation retained Sora's context. |
| Writer mobile | Plum identity, index, and complete poem with deliberate line breaks remained readable. |
| Film | Ivo's original test clip loaded with duration 2s, readyState 4, width 640, native controls enabled. In the production editor, Edit disabled playback controls for selection and Browse re-enabled them. |
| Backup/reload | Copied 6,308-character v3 JSON through the actual export UI, changed the poem title, restored the saved JSON via file chooser and confirmation, and reloaded. Original poem/title, #482c42 ink, and 108% reading scale returned. |
| Production | Cinema project and mobile iframe rendered from `dist`; Browse/Edit behavior worked; fresh production tab reported no warning/error console logs. |

Contrast guidance is based on the [WCAG contrast-minimum explanation](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). It checks solid canvas/text/accent pairs. It does not measure every muted label, photographic overlay, focus state, or all text combinations in a full accessibility audit.

## Screenshots

| Fictional study | Desktop | Mobile | Detail |
|---|---|---|---|
| Mara / Folio | [Homepage](evidence/identity-mara-desktop.jpg) | [Homepage](evidence/identity-mara-mobile.jpg) | Licensed photographic sample |
| Sora / Gallery | [Homepage](evidence/identity-sora-desktop.jpg) | [Homepage](evidence/identity-sora-mobile.jpg) | [Mobile project](evidence/identity-sora-project-mobile.jpg) |
| Noor / Archive | [Index](evidence/identity-noor-desktop.jpg) | [Index](evidence/identity-noor-mobile.jpg) | [Mobile poem](evidence/identity-noor-poem-mobile.jpg) |
| Ivo / Cinema | [Homepage](evidence/identity-ivo-desktop.jpg) | [Homepage](evidence/identity-ivo-mobile.jpg) | [Native film](evidence/identity-ivo-film-mobile.jpg) |

[Artist studies](evidence/identity-studies.jpg) · [Direct title editing](evidence/identity-inline-title.jpg) · [Contextual writing](evidence/identity-context-writing.jpg) · [Restored identity panel](evidence/identity-panel-restored.jpg) · [Built mobile preview](evidence/identity-production-mobile-preview.jpg) · [Actual exported v3 backup](evidence/identity-browser-backup.json).

Older screenshots/backup files copied with the previous stage remain in `evidence/`; only the `identity-*` files are evidence for this milestone.

## Limits and remaining work

The actual backup chooser took approximately 14 minutes to return through computer-use automation despite a requested 15-second action timeout. It eventually reached the correct restore screen and the restore/reload checks passed. This is a tool-mediated chooser delay, not a reliable browser-upload performance measurement. No further chooser repetition was attempted. A completed native backup-download receipt remains unverified; clipboard export and actual file restore passed.

The existing local upload/focal/stale-editor behavior was browser-tested in the previous stage and retained; this milestone reran its automated contracts and checked direct media targeting. It did not force a slow upload/deletion race, quota exhaustion, browser/OS termination, or a new same-studio multi-window conflict in the browser. The prior stage's stale-window browser evidence is retained. Pending saves may be lost under process termination; undo is session-local; internal recovery copies do not yet have a history UI.

This is not a full cross-browser, screen-reader, physical-device, IME-composition, or accessibility certification. Font controls use local/system stacks; no font-upload or external font service. Cinema's full-bleed cover remains direction-specific and is explained by the controls. Four samples are simulated coverage, not user research.

Flexible sections/layouts, richer mobile art direction, media optimization, persistent version history, accounts, cloud storage, draft/live publishing, private links, domains, billing, and integrations remain deferred. Nothing was published or pushed. No service accounts, paid resources, credentials, domains, or Habib Saleh artworks were used.

## Next bounded increment

Build flexible composition on the existing ordered content model: authored section arrangements for single images, paired images, image plus writing, reading sections, and mixed-media interludes. Provide width/alignment/grouping and deliberate mobile stacking, with a live comparison and explicit undoable choice. Retain every word/asset ID and existing crop/focal setting; do not silently rewrite the artist's work. Complete that locally before beginning external publishing infrastructure.
