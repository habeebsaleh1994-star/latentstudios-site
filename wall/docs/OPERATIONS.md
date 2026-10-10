# Operations: where everything lives and the one way to do each thing

Everything runs on the one Cloudflare account (the studio's). There are exactly three things online, and one command for each job. Run them from `wall/`.

| What | Where it lives | Made of |
| --- | --- | --- |
| **Wall itself** (arrival page, the app, the samples) and **its service** (sign-in, the sites on the server, publish) | `https://wall.latentstudios.art`, `/api/*` | the Worker `latent-wall` (`api/worker.js`), serving the static build in `wall/dist`, with the D1 database `latent-wall` (accounts, sessions, invites, sites) and the bucket `latent-wall-sites` (pictures under `_accounts/`) |
| **Published sites** | `https://<label>.latentstudios.art` | the Worker `latent-wall-sites` reading the bucket `latent-wall-sites`, a folder per site, through one wildcard route |
| **The studio site** | `https://latentstudios.art` | the Pages project `latentritual-site`, untouched by any of this |

## The jobs

| Job | Command | What it does |
| --- | --- | --- |
| Put the current Wall online | `npm run release` | builds `dist/` from the code and deploys it to wall.latentstudios.art |
| Make a key for someone | `npm run invite -- make <name>` | prints the key once and puts its hash in the live database; nothing to deploy |
| Take a key back | `npm run invite -- revoke <name>` | an account already made with it stays |
| See who has a key, and who used it | `npm run invite -- list` | |
| Work on the service locally | `npm run api` beside `npm run dev` | the service on 8787 with a local database and bucket; the dev server proxies `/api` to it. The schema: `npx wrangler@latest d1 execute latent-wall --local --file api/schema.sql -c deploy/wrangler.toml` |
| Change the database's shape | edit `api/schema.sql`, then `npx wrangler@latest d1 execute latent-wall --remote --file api/schema.sql -c deploy/wrangler.toml` | the file is written to be run again safely |
| Turn mail on | `npx wrangler@latest secret put RESEND_KEY -c deploy/wrangler.toml` | until then the door hands the sign-in link back on the page |
| Put a friend's published site up | `npm run host -- <name> <folder-or-zip>` | uploads their files to the bucket under `<name>/` |
| Take a friend's site down, because they asked to stop | `npm run host -- down <name>` | removes every file of the site from the bucket; then take its line out of `host/wrangler.toml` and `npm run sites` to free the address |
| Publish a site whose document is kept in a repo (Habib's own) | `npx tsx scripts/publish-files.mts <site.json> <root of its pictures> <out>` then `npm run host -- <name> <out>` | what Publish in the app does, for a document on disk |
| Give every published site its address | once: in the zone's DNS, an A record, name `*`, content `192.0.2.1`, proxied | the wildcard route in `host/wrangler.toml` already sends every `<label>.latentstudios.art` to the sites Worker, which hands `wall` to Wall itself (a route beats a custom domain, so the two Workers are bound) |

## Where things are in the code

- `deploy/wrangler.toml`: Wall's address and how it is served. `scripts/build-site.mjs`: what goes into `dist/`.
- `host/worker.js` and `host/wrangler.toml`: the friends' sites Worker and their addresses. `scripts/host-site.mjs`: the upload.
- `api/worker.js` and `api/schema.sql`: the service and its tables. `src/app/account.ts`: the door and the app's side of the service. `src/app/main.ts` (`syncMine`, `pushNow`): how the site reaches the server. `scripts/invite.mjs`: keys.
- `tests/browser/account-walk.mjs`: the whole flow, door to delete, against `npm run dev` + `npm run api` (+ the sites Worker locally; see the file).
- `design/home/testing.html`: the page friends receive. `docs/RELEASE.md`: the checklist and the decisions.

## Rules that keep it clean

- Nothing is deployed that is not committed. Build from the code, never edit `dist/`.
- One Worker per thing, named for what it is. No second copy of Wall anywhere; the old `/wall` folder on the studio site is gone.
- Secrets are set with `wrangler secret put`, never written in a file. The service hands no sign-in link back once mail is on.
