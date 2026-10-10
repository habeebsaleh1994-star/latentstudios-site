# Operations: where everything lives and the one way to do each thing

Everything runs on the one Cloudflare account (the studio's). There are exactly three things online, and one command for each job. Run them from `wall/`.

| What | Where it lives | Made of |
| --- | --- | --- |
| **Wall itself** (arrival page, the app, the samples) | `https://wall.latentstudios.art` | the Worker `latent-wall`, serving the static build in `wall/dist` |
| **Friends' published sites** | `https://<name>.latentstudios.art` | the Worker `latent-wall-sites` reading the bucket `latent-wall-sites`, a folder per site |
| **The studio site** | `https://latentstudios.art` | the Pages project `latentritual-site`, untouched by any of this |

## The jobs

| Job | Command | What it does |
| --- | --- | --- |
| Put the current Wall online | `npm run release` | builds `dist/` from the code and deploys it to wall.latentstudios.art |
| Make a key for someone | `npm run invite -- make <name>` | prints the key once; then `npm run release` so Wall knows it |
| Take a key back | `npm run invite -- revoke <name>` | then `npm run release` |
| See who has a key | `npm run invite -- list` | |
| Put a friend's published site up | `npm run host -- <name> <folder-or-zip>` | uploads their files to the bucket under `<name>/` |
| Take a friend's site down, because they asked to stop | `npm run host -- down <name>` | removes every file of the site from the bucket; then take its line out of `host/wrangler.toml` and `npm run sites` to free the address |
| Give a friend's site its address | add `{ pattern = "<name>.latentstudios.art", custom_domain = true }` to `host/wrangler.toml`, then `npm run sites` | the address, its DNS record and certificate are made by that deploy |

## Where things are in the code

- `deploy/wrangler.toml`: Wall's address and how it is served. `scripts/build-site.mjs`: what goes into `dist/`.
- `host/worker.js` and `host/wrangler.toml`: the friends' sites Worker and their addresses. `scripts/host-site.mjs`: the upload.
- `app/keys.json`: the fingerprints of valid keys (never the keys). `src/app/invite.ts`: the door.
- `design/home/testing.html`: the page friends receive. `docs/RELEASE.md`: the checklist and the decisions.

## Rules that keep it clean

- Nothing is deployed that is not committed. Build from the code, never edit `dist/`.
- One Worker per thing, named for what it is. No second copy of Wall anywhere; the old `/wall` folder on the studio site is gone.
- When sign-in arrives, `host/` grows into it; the table above gets a row, not a rewrite.
