# Latent Wall

The artist website builder for the Latent ecosystem. Templates, looks and the editor are plain pages under `design/`; the document and storage code is in `src/studio/`. Product decisions are in `docs/PRODUCT.md`, parked ideas in `docs/IDEAS-PARKED.md`.

```sh
npm install
npm run dev            # http://127.0.0.1:5181/ (design/home is the start)
npm test               # document, store and look tests
npm run studio:lib     # rebuild design/shared/studio.js after changing src/studio
npm run matrix:quick   # browser checks of every look; npm run matrix for all combinations (slow)
npm run wall:sync      # copy the templates into the site's public/wall
```
