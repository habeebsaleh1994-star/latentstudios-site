# Canvas composition studies — 0.10.0

This local milestone makes an existing section or group directly adjustable on the website canvas, and lets an artist keep and compare alternate arrangements of the same materials. It does not establish market novelty or production readiness.

## Review locally

Use the existing workbench at **http://127.0.0.1:5181/**. On a project, writing or about page, select **Arrange**. The first use keeps a **Starting point** study, then enables the shared composition layout. Existing groups remain intact. The original style layout can also be retained as a study.

- Drag the numbered grip to move a section or an existing group. The insertion line marks the destination; approaching the preview's top or bottom scrolls it. Space/Enter picks up a focused grip, arrows or Home/End choose a position, Enter places it, and Escape cancels.
- Drag the width edge to snap between desktop reading/wide/full widths (64%, 84%, 100%) or mobile inset/full (88%, 100%). Arrow keys also resize. Original media, crop mode and focal point are unchanged.
- Drag the spacing control above a section. Arrow keys adjust 4px, Shift+arrow adjusts 16px. Desktop permits 0–180px and mobile 0–120px. Width and spacing keyboard repeats commit together on key release.
- Choose **Try arrangements** for three rendered desktop alternatives of the selected 1–4 works. “In conversation”, “A work leads” and “A slower reading” change only that section's geometry. They retain work order, asset references, text, captions, crops, identity and all mobile decisions. Cancel does not edit the draft; Apply is one Undo step.
- Open **Composition studies**, name the current arrangement and keep it. Choose a saved study to preview it without changing the draft. **Use this arrangement** first keeps the displaced arrangement as a new study, then applies the chosen one. Up to 12 studies are allowed per page; removing one is undoable. A new study can be kept without leaving the comparison, and always captures the current draft.
- Mobile order and geometry remain independent once authored. Changing the editor's width no longer silently turns a desktop preview into mobile geometry: desktop uses at least a 1024px viewport and scales to fit. Mobile remains a real narrow viewport. At small desktop scales, the sidebar offers larger controls; Mobile preview is better for mobile editing.

## Durability and authorship

Studies store block IDs and composition only. They do not contain copied text or media. Applying an older study uses every surviving work's **current** caption, text, file reference, crop and focal point. Removed works stay removed; added works are appended and the comparison reports added/removed counts. This is arrangement history, not a full content revision. Existing Release & recovery checkpoints remain the full-document mechanism.

Pointer movements and held keyboard changes live in component state until the gesture finishes. They produce one document update and therefore one Undo item. Escape, pointer/touch cancellation, loss of focus, device/viewport changes and leaving the page discard unfinished geometry. No autosave is queued for an unfinished gesture. Command-Z works inside the preview. Native image dragging and accidental text editing are disabled in Arrange mode; Edit mode remains the text workflow.

Document and editable backup version **8** adds optional page studies. Versions 1–7 still read through the existing migrations without rewriting storage. The first v8 save retains the exact previous record as `pre-canvas-studies`; recovery exposes it as **Before canvas studies**. Backups keep studies and originals. Public HTML, folder ZIP and the separate local backend's data artifact omit unused studies and their names; they retain the applied composition. The backend remains disconnected from the browser editor.

The pre-change source archive is `docs/recovery/pre-canvas-studies-v0.9.0.tar.gz`. It contains code, not the user's browser draft. Do not roll code back blindly against a v8 document: older code cannot read v8; retain an editable backup and use the appropriate preserved recovery record if needed.

## Verification performed

- **174 tests across 10 files pass.** The 14 added cases cover exact source preservation, 1–4-work alternatives, reconciliation after additions/removals, one-step Undo/Redo, mobile independence, schema rejection, v7 recovery, v8 backup round trips and actual public export/backend omission of private studies.
- **Lint, client TypeScript, backend TypeScript and production build pass.** Existing nonfatal warnings remain: experimental Node SQLite, two third-party Zod annotation warnings, and a 590.37 kB minified editor chunk above Vite's 500 kB warning threshold. This work did not suppress warnings or change dependencies.
- **Actual Chromium 145 browser interaction passed** in a fresh in-memory profile and random, previously nonexistent synthetic workspace. Tests never load Safari's profile or the main draft database. The setup explicitly refuses an existing test document.
- Pointer group movement with autoscroll, pointer width resizing, keyboard movement/spacing, touch width adjustment/cancellation, mobile spacing limits, exact Undo/Redo, caption editing, comparison/cancel/apply, interrupted reload and saved study persistence were exercised.
- The full sequence **move → resize → caption edit → mobile-only reorder → Undo → desktop** retained exact desktop geometry, content and selection. Tests compared stored documents and DOM output; screenshots were visually reviewed.
- Editor and preview widths **360, 390, 768 and 1440** had no horizontal overflow. A scaled desktop pointer resize at 768 preserved the real 1024px viewport and affected desktop geometry only. The 390px study shelf retains a usable 430px preview; the alternatives dialog is scrollable.
- No browser page errors were recorded. [Machine-readable browser results](evidence/canvas-studies/browser-results.json), [test log](evidence/canvas-studies/tests.txt), [lint log](evidence/canvas-studies/lint.txt), [build log](evidence/canvas-studies/build.txt).

Review images: [canvas](evidence/canvas-studies/canvas-final-desktop.png), [three alternatives](evidence/canvas-studies/alternatives-desktop.png), [saved study comparison](evidence/canvas-studies/study-comparison-desktop.png), [390px study shelf](evidence/canvas-studies/studies-mobile.png), [mobile alternatives](evidence/canvas-studies/alternatives-mobile.png), [rendered artist website](evidence/canvas-studies/rendered-artist-site.png). Mira Vale and all captions are fictional test material; the geometric works and test film are original bundled demo assets.

The reproducible browser runner is `scripts/verify-canvas-browser.mjs`. Playwright was installed outside this project in `/tmp`, so it is not an app dependency. With the dev server running and the test installation available:

```sh
LATENT_PLAYWRIGHT_MODULE=/tmp/latent-canvas-browser/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/tmp/latent-canvas-browsers \
node scripts/verify-canvas-browser.mjs
```

The runner deliberately needs the local Vite source server. Its setup uses application modules solely to seed a new synthetic workspace and read saved evidence; interaction assertions use the rendered UI, pointer/keyboard/touch input and actual DOM. On another machine, install Playwright and a browser in a chosen test location and set those paths accordingly. No user profile should be supplied.

## Limits and next design work

This remains a constrained section layout. It has no free-positioned elements, overlap, arbitrary coordinates, rotation, dragging an individual work between groups, or multiselection directly on the canvas. Grouping is still performed in the existing sidebar. Three alternatives are deterministic, desktop-only and apply to one existing section, not a generative whole-page design system. Studies are named snapshots without rename or branching trees. Undo is session-local; a kept study survives reload. Save indicators and backups remain necessary for browser storage durability.

This increment was verified in Chromium, including emulated touch input. It has not been retested in Safari/WebKit, on a physical touch device, or through a complete assistive-technology audit. Automated checks cannot establish that the product meets an artist's aesthetic standard; direct artist use is the next quality gate.

A useful next interaction milestone would be selecting and regrouping works on the canvas, with explicit insertion targets and responsive reading-order constraints, then richer artist-authored alternate arrangements. That should precede broader spatial freedom or more presets. Onboarding, subscriptions, quotas, cloud durability, hosting, domains and billing remain deferred. No website was published, no account connected, and no remote push or Ritual change was made in this increment.

An initial browser setup was rejected by automatic approval review because it named the default draft database. It did not run. The revised setup uses a fresh browser context plus a new random workspace and refuses existing documents; review approved it and all browser checks completed there. No permission blocker remains.
