# Media delivery and Ritual contract verification — 2026-10-04 UTC

Canonical workbench: `latent-studio-workbench`, application **0.6.0**. Draft/backup schema stays **5**; immutable revisions stay **1**; portable website envelope is now **2**. Earlier projects on 5178/5179, the main draft, and the user's Safari session were untouched.

## Completed checks

`npm run build` (including TypeScript), `npm run lint`, and `npm test` pass: **82 tests across six files**. Ten media/package tests add dimensions/no-upscaling, EXIF decode options, whole-image preservation, animation detection, cancellation/failed encoding, cache quota failure and successful retry, video/vector preservation, ZIP checksums/paths, responsive relative media and provenance. The existing 72 persistence, conflict, recovery, migration, composition and publication checks still pass.

Build: CSS 72.80 kB / 15.12 kB gzip; editor 515.74 / 152.37 kB; lazy export module **332.05 / 94.19 kB**, down from 808.62 / 187.94 kB. The dedicated viewer bundle excludes the editor model validator, Zod, sample seeding and draft storage. The editor still triggers Vite's 500 kB advisory; two upstream Zod comment annotations are removed by Rollup. No failing checks were suppressed.

## Real browser evidence

The connected Mac's browser was used at 1440×960 and 390×844. Development: 5181; separately built editor: 5182; independently served extracted website folders: 5183.

- In the actual release UI, Mara's frozen originals were prepared, the per-file details appeared, web copies were selected, and a ZIP download link with the correct filename appeared. Prepared cache state survived reload. No draft or original changed as a consequence of preparation.
- On the production build, successive title edits followed by page navigation and reload retained the latest text. The fictional sample title was restored, readiness passed, a named release was created, web images prepared and ZIP output generated. No captured warning/error console messages.
- Four ZIPs were produced in a development-only harness using the real sample factory, frozen-media collector, derivative processor and package exporter. Browser-produced bytes were read from its explicit verification textarea in chunks and saved. Python's independent ZIP reader verified every CRC, byte length and content-addressed filename hash. A prior clipboard extraction was incomplete and was replaced before verification; it is not evidence of a ZIP encoder defect.
- Every extracted site ran on an independent origin with no editor storage access. Folio, Gallery, Cinema and Archive were checked at desktop and phone widths; no document horizontal overflow was observed. Navigation and image loading worked. Gallery mobile menu links worked; Archive search narrowed the index and opened a reading page. Standalone page changes focused the destination main region.
- Cinema programme Shift-Tab/Tab wrap within the dialog. Escape closes it and restores the opener. Its exported film loaded with native controls and readyState 4, and fits the mobile viewport. This verifies local file delivery, not streaming/transcoding.
- Folio's authored portrait crop and `23% 82%` focal point survived export as layout, with intact full-image variants. A fresh 390px project load selected a 640px-wide, 19,948-byte image for a 344px slot instead of the 297,660-byte original. Already-loaded larger candidates can remain selected by the browser after resize.
- A real cancelled preparation returned before decoding or caching. The actual OS reduced-motion preference was not changed: shipped CSS rules were inspected and disable transitions and smooth scrolling. Reduced-motion emulation, a complete screen-reader audit and cross-browser matrix remain unverified.

## Measured image behavior

One local browser run; timing is not an SLA. See [raw measurements](evidence/media-browser-measurements.json).

| Fixture | Original | Largest retained copy | Result |
|---|---:|---:|---|
| Sea photograph, 2000×1333 | 297,660 B | 193,992 B | 640 / 1280 / 2000px copies; 230ms |
| Same photo, EXIF orientation 6 | 297,696 B | 188,342 B | effective 1333×2000 matches browser original; 222ms |
| Transparent/translucent PNG, 1800×1200 | 5,408,327 B | 1,241,190 B | alpha samples remain 0 / 128 / 255; 341ms |

All original SHA-256 hashes were unchanged. The EXIF fixture changes only orientation metadata on the licensed demo photograph; the alpha fixture is generated synthetic content. This is not proof of calibrated wide-gamut color fidelity. Display copies are browser-produced sRGB WebP; original profiles and metadata remain in originals.

Responsive folders carry multiple sizes, so total package media can exceed originals. Mara's folder contains 2,727,190 media bytes versus 1,909,391 original bytes; its ZIP is 3,068,630 bytes. Per-request image savings and removal of base64 overhead are the intended benefits. SVG and film originals remain unchanged. [Package integrity results](evidence/media-package-checks.json).

## Deliverables

- [Folio ZIP](evidence/media-mara-web.zip), [Gallery ZIP](evidence/media-sora-web.zip), [Archive ZIP](evidence/media-noor-web.zip), [Cinema ZIP](evidence/media-ivo-web.zip)
- Extracted `index.html` and relative `media/` files under `docs/evidence/media-packages/{mara,sora,noor,ivo}/`.
- [Release workspace](evidence/media-delivery-workspace.jpg) / [mobile](evidence/media-delivery-mobile.jpg), [orientation and transparency comparison](evidence/media-orientation-alpha.jpg)
- [Folio desktop](evidence/media-folio-desktop.jpg) / [mobile](evidence/media-folio-mobile.jpg)
- [Gallery desktop](evidence/media-gallery-desktop.jpg) / [mobile](evidence/media-gallery-mobile.jpg)
- [Cinema desktop](evidence/media-cinema-desktop.jpg) / [mobile](evidence/media-cinema-mobile.jpg)
- [Archive desktop](evidence/media-archive-desktop.jpg) / [mobile](evidence/media-archive-mobile.jpg)

The browser automation's native ZIP download timed out after 15 seconds. The app's generated Blob and link were verified, and independent ZIP extraction/rendering passed; native download-to-disk receipt is still unverified. No fallback claimed a completed native download.

## Remaining limits and integration blocker

Ritual source inspection found PDF export and internal library-scoped sequence records, **no supported structured Story + media interchange**. No speculative importer was added. [Exact source evidence and required contract](RITUAL-STORIES-IMPORT-PLAN.md).

Derivatives use a separate rebuildable IndexedDB cache. Browser eviction, actual disk exhaustion, forced power loss, large mixed-media stress and calibrated color review remain outstanding. Images over 32MP retain originals after decoding; this is not a pre-decode memory sandbox. No cache pruning or background worker. The artist explicitly chooses web copies; draft editing remains on originals. JavaScript is required in exported sites.

Earlier full recovery tests/evidence: [publication](PUBLICATION-VERIFICATION.md), [composition](COMPOSITION-VERIFICATION.md), [identity](IDENTITY-VERIFICATION.md). Pre-change source: `docs/recovery/pre-media-source-v0.5.0.tar.gz` (not a browser-data backup).

Only canonical port 5181 remains running after QA. No publication, remote upload, signup, credentials, DNS, domain purchase, paid service, remote push or other Latent product write occurred. [Production decisions and next bounded local increment](PRODUCTION-DECISIONS.md).
