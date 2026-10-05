# Local release & recovery verification — 2026-10-04 UTC

Canonical project `latent-studio-workbench`, application 0.5.0, document and backup version 5. Fictional, isolated demo studios were used. The user's Safari work and main draft were not used for QA. Earlier 5178/5179 projects were not modified.

## Automated checks

`npm run build` (including TypeScript), `npm run lint`, and `npm test` pass. **72 tests across five files**: 49 existing content/identity/composition checks plus 23 publication/media ownership checks.

New tests cover v4 migration and exact pre-migration retention; immutable document/media copies; reading/restoring frozen media after the source asset store is unavailable; draft-versus-release separation; recover-the-replaced-draft flows; stale draft and release-pointer rejection; transaction rollback on failed snapshot/release/document writes; imported media rollback; multiple retained imports; missing/undecodable media; language/canonical metadata; contrast/empty destinations; hostile JSON/HTML boundaries; arbitrary SVG refusal and exact bundled-vector acceptance; cancellation; all four styles and route maps in portable HTML; and structural comparisons.

Final production output: CSS about 72 kB (15 kB gzip), editor entry about 506 kB (149 kB gzip), lazy portable-export module about 809 kB (188 kB gzip). Vite reports its 500 kB chunk-size advisory and removes two misplaced upstream Zod annotation comments. These are known build advisories, not ignored failing checks. No dependency upgrades were made; the already installed esbuild version is now an explicit locked build dependency.

## Actual browser checks

The in-app browser on the connected Mac was used for real UI actions. Development ran on 5181; a separately served production build on 5182; generated output on an independent loopback origin 5183.

- Sora's metadata saved; browser preflight decoded all three geometric originals and allowed an explicitly named local release.
- Editing the project title afterwards left the immutable release preview unchanged. Links within the frozen preview retained its revision identity.
- The recovery inspector showed the changed title. Restoring the release created a new draft and an outgoing-draft recovery point. Restoring the pre-import record later recovered the prior metadata/content.
- Invalid pasted JSON produced an error without a new draft. The real `composition-browser-backup.json` (v4) imported through the new paste UI. The pre-import draft remained recoverable.
- The final restore path copied all frozen originals to new IDs. Browser-exported `publication-v5-browser-backup.json` contains three embedded vector originals and successfully re-imported through the UI with collision remapping.
- A named checkpoint survived reload. Another editor received the existing stale-window warning after a metadata save; it did not overwrite the current draft.
- A production Ivo release rejected a `javascript:` canonical address, then allowed release after correction while retaining the film accessibility observation.
- Native modal keyboard behavior was checked. Shift-Tab wraps to the last enabled dialog control. Escape closes the dialog and restores focus to the Release & recovery opener. At 390px, the release dialog fits within the viewport with no document overflow. A full screen-reader audit remains outstanding.
- Production release history survived reload and produced no captured warning/error console entries in the checked flow.

## Export proof

These artifacts came from the actual UI's **Prepare website export → Copy file contents** path, saved into the workspace without a native chooser:

- [Sora website](evidence/sora-local-release.html): about 0.76 MB, all images embedded as data URLs, routes continue within the file, deep-link reload works. Checked at 1440×960 and 390×844. Mobile preserves authored writing-first order and reverses the image pair. The document width equals 390px without overflow.
- [Ivo website](evidence/ivo-local-release.html): about 2.5 MB, exported Cinema programme/sequence controls work. The film is embedded, has native controls, readyState 4, duration 2 seconds and 640×360 metadata on the independent origin. No captured warning/error console entries.

The independent origin has no access to the editor origin's IndexedDB. All inspected displayed media use embedded data URLs. The artifacts use the read-only runtime and do not need the development server. This proves local portability; it does not prove public hosting, SEO indexing or a no-JavaScript experience.

## Screenshots

- [Release workspace](evidence/publication-workspace.jpg)
- [Small-screen release workspace](evidence/publication-workspace-mobile.jpg)
- [Recovery inspector](evidence/publication-recovery-inspect.jpg)
- [Stale editor warning](evidence/publication-stale-window.jpg)
- [Exported desktop composition](evidence/publication-export-desktop.jpg)
- [Exported mobile composition](evidence/publication-export-mobile.jpg)
- [Exported film](evidence/publication-export-film.jpg)

Earlier composition and four-style evidence remains in [COMPOSITION-VERIFICATION.md](COMPOSITION-VERIFICATION.md) and [IDENTITY-VERIFICATION.md](IDENTITY-VERIFICATION.md).

## Honest limits

Native download-to-disk receipt and the native file chooser were not re-tested; clipboard-generated file contents and the pasted-import UI were verified. Storage failures were injected at the IndexedDB transaction boundary in automated tests, not by filling the user's real disk. No forced process/power-loss, 60 MB mixed-media stress, physical phone, cross-browser Safari/Chromium matrix, or complete assistive-technology audit was performed. Media review cancellation has automated coverage; it was not timed against a deliberately stalled real film in the browser.

Comparisons are structural and explicitly identify changed media references; copies after recovery can differ despite looking the same. Legacy recovery records retain references; current named checkpoints/releases embed frozen originals. External backups hold one draft/edition, not the entire revision library. No pruning or deletion occurs.

Only 5181 remains the canonical running review server after QA. Temporary verification servers are stopped. No publishing, signup, credentials, domains/DNS, purchases, uploads to a remote service, remote pushes or other Latent product writes occurred.
