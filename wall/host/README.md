# Hosting published sites, by hand

For the closed test: an artist publishes, sends the files, and we put them up the same day.

1. Once: create the bucket `latent-wall-sites` in the Cloudflare account, deploy the Worker from this folder (`npx wrangler deploy`), and route the Worker to the sites domain (`*.latentstudios.art/*` or whatever is decided; see `wrangler.toml`).
2. Each time: `node scripts/host-site.mjs <name> <folder-or-zip>` from `wall/`. The site is then at `https://<name>.<domain>/`, exactly that version.

The Worker serves clean URLs, the site's own 404 page, long cache for `assets/`, none for pages, and frames only from the same origin. It is Stage 2's hosting in miniature: when accounts arrive, Publish will put the files into the same bucket itself.
