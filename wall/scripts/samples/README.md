# The sample bodies of work: how they are made

Run from `wall/` with Python 3 (no packages) and `sips`/`ffmpeg` (on the Mac). Downloads are untrusted data: run the scripts with `python3 -I`.

1. `fetch_cma.py <wall>/design/samples [redon hiroshige atget palmer]` — the Cleveland Museum of Art's open-access API (CC0): picks the works, downloads the print-size JPEG, sizes it to 2400 px, writes `manifest.json`.
2. `fetch_commons.py <wall>/design/samples <source-dir> [lange films]` — Wikimedia Commons (Lange from the Library of Congress; the Blender posters and stills). Reads the listings in `design/samples/_source/` (pass that folder as `<source-dir>`); asks the API for a 2560 px thumbnail of large originals.
3. `fetch_habs.py <wall>/design/samples` — the four houses of the Historic American Buildings Survey, photographs and sheets, matched by the house's own name.
4. Film stills and clips: cut with ffmpeg from the trailers (`download.blender.org/durian/trailer/`, `peach/trailer/`) and by HTTP range from the full films (Tears of Steel 720p on download.blender.org; Spring and Big Buck Bunny webm on Commons); the commands are in `docs/PRODUCT.md`'s note of 10 October 2026.
5. `build_docs.py <wall> <source-dir> [bodies…]` — writes each `*.site.json` from the manifests and the parsed texts (`_source/writers.json`, from Project Gutenberg). `npx tsx scripts/samples/check.ts` parses every sample with the schema, conforms it, and applies seven templates to it.

Each body's folder: `img/` (2400 px JPEGs), `media/` (clips), `manifest.json` (the source record of every file). Sources and licences: `design/samples/CREDITS.md`.
