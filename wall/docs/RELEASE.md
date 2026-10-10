# Release: the closed test, then the release

Decided 10 October 2026. Wall goes first to a few artists, on a domain we make, at release quality and with no payments. When their feedback says it holds, the proper release follows, with domains and plans.

## What "release quality" means here

Every sweep and audit green in Chromium and WebKit before anyone outside sees it (the one time the sweeps are for; between changes we fix and look at the page concerned). Nothing in the editor that changes nothing. Every template with a body of work of its own kind. The published files complete, self-contained and sealed where the artist asked. Day and night. Phone. Keyboard and screen reader. Nothing that says "soon" without saying what.

## The build

`node scripts/build-site.mjs` writes `dist/`: the arrival page at `/`, the app at `/app/`, the samples and shared assets at the absolute paths the app uses while we work, and a `_headers` file (frames allowed from the same origin, not for search engines yet, long cache for fonts and samples). About 227 MB, most of it the sample bodies of work. Checked from a plain static server: arrival page, demos with the editor, the start page, nothing missing.

## Hosting, for the test

The studio site is a Cloudflare Pages project (`latentritual-site`, origin latentstudios.art). The cleanest shape:

- **Wall itself:** a second Pages project from `wall/dist`, on a subdomain of the zone we already have, e.g. `wall.latentstudios.art`. One command to deploy (`wrangler pages deploy dist`); no change to the studio site.
- **Testers' sites:** Publish gives the artist their files. For the test, we host them by hand: either one Pages project per tester with a custom domain, or one Worker in front of the R2 bucket serving `name.latentstudios.art` from a folder per tester. The Worker is Stage 2's hosting in miniature and worth building now, since it will be kept.

Decisions that are Habib's: the address for Wall; whether testers' sites live under `latentstudios.art` or a new domain such as `latent.site` (the Publish panel currently promises `name.latent.site`; it must say the real address before testers see it); who tests, ideally one artist per kind of template.

## Checklist before the link goes out

- [ ] Full sweeps in both engines green (`tests/browser/*.mjs`, see the README there)
- [ ] Audits: `scripts/visible.ts` (silent choices), `scripts/distinct.ts`, `scripts/speed.ts`; hands and night sweeps
- [ ] Build from a clean checkout; open the arrival page, a demo, the start page, Publish, from the static build
- [ ] The Publish panel's address line says what is true for the test
- [ ] The testers' page (`design/home/testing.html`) says what Wall is, what stays in the browser, how to send files, how to report
- [ ] Decide the 15 MB upload cap wording in the picker (decided 5 October; apply here)
- [ ] A way for testers to reach Habib (an address in the testers' page)
- [ ] Deploy Wall; deploy the first tester site by hand; open both in Safari on a phone

## Known, told to testers rather than fixed first

- Everything is English only.
- A site lives in the browser it was made in until it is published; clearing the browser's data loses the draft (published versions are kept on the device too, but not elsewhere).
- Films up to 400 MB are kept on the device; the files carry them whole.
