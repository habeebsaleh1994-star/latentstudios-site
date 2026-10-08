# Latent Wall

The artist website builder for the Latent ecosystem. One app (`app/`, `src/app`) renders and edits a whole site from the site document (`src/studio/site.ts`); the nine templates are in `src/app/houses.ts`; the looks and the picture viewer are plain scripts in `design/shared/`; the home page is `design/home/`. Product decisions are in `docs/PRODUCT.md`, parked ideas in `docs/IDEAS-PARKED.md`.

```sh
npm install
npm run dev            # http://127.0.0.1:5181/ (design/home is the start; /app/index.html is the app)
npm test               # the site document, every editing operation, every choice, every template's promises, the looks
node tests/browser/<name>.mjs chromium|webkit   # browser sweeps against the dev server; see tests/browser/README.md
```
