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

- [x] Full sweeps in both engines green, 10 October 2026: 17 sweeps × 2 engines, every one clean
- [x] Audits, 10 October 2026: visible 1,457 presses, 4 called silent (one a work in the middle of a long page the audit does not photograph, three the reading size on a board, now sent to a page with words); distinct medians 0.12 – 0.66; speed median LCP 76 ms, layout shift ≤ 0.001
- [x] Build checked from a plain static server, 10 October 2026 (rebuild at deploy time: `node scripts/build-site.mjs`)
- [ ] The Publish panel's address line says what is true for the test
- [x] The testers' page (`design/home/testing.html`); confirm the address on it (hello@latentstudios.art) is a mailbox that is read
- [x] The 15 MB cap is enforced in the store and said in the picker; films 400 MB
- [ ] A way for testers to reach Habib (an address in the testers' page)
- [ ] Deploy Wall; deploy the first tester site by hand; open both in Safari on a phone

## Known, told to testers rather than fixed first

- Everything is English only.
- A site lives in the browser it was made in until it is published; clearing the browser's data loses the draft (published versions are kept on the device too, but not elsewhere).
- Films up to 400 MB are kept on the device; the files carry them whole.

## Beta, by invite

Wall is labelled Beta · by invite and stands behind a door: a key per person, made with `node scripts/invite.mjs make <name>` (said once; give it to them), revoked with `revoke <name>`. The app carries only the keys' hashes in `app/keys.json`, so making or revoking a key means a rebuild and a deploy. Published sites and the arrival page's previews are open to everyone; only making a site needs a key. When sign-in arrives, the key becomes the invitation that lets an email in, and the door goes.
