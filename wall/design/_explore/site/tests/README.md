# Tests for the site study

Scripted sweeps against the dev server (`npm run dev`, port 5181), using Playwright's Chromium and WebKit from `wall/node_modules`.

- `node sweep.mjs chromium` / `node sweep.mjs webkit`: every view and editor action at desktop size, including two windows editing the same site.
- `node phone.mjs chromium` / `node phone.mjs webkit`: the same at phone size (390 × 780).
- `node flow.mjs chromium` / `node flow.mjs webkit`: the whole way through, home page → start → upload from disk → look → publish → unzip → open the files; screenshots and the zip land in `/tmp/site-study-shots` (create it first).

All three print `all steps passed` or a list of failures. Last full pass: 6 October 2026.
