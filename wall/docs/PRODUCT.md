# Latent Wall: product direction

## The roadmap (Habib, 6 October 2026)

> All other platforms have weaknesses: they are not really designed well, and they have so much hassle and clutter. Get this out of the way for artists. Give them something beautiful, nice and state of the art, without them worrying much about it, but still with the freedom to customise and edit, so they have unique portfolios instead of all the same identity, which is a downside for an artist trying to show their full identity.

What that means in practice:
1. **No hassle, no clutter.** The site is beautiful from the first minute; every control is hidden until it is reached for.
2. **State of the art.** Better designed than any builder in every detail; nothing ships until it is flawless. These are artists' portfolios.
3. **Freedom without ugliness.** Real editing (pages, stories, order, arrangement, words) and real customising (look, colour, type, spacing, motion), all designed choices, so no combination can look wrong.
4. **The artist's own identity.** Two artists must never end up with the same site. Houses, arrangements, looks and the work itself make each portfolio distinct; Latent's taste lives in the craft, not in a shared skin.

Every change is checked against two questions: does the artist have to worry about this? Could two artists end up with the same site?


Written 5 October 2026 from conversations with Habib. Change freely until it is built.

## What it is

Latent Wall (working name, decided 5 October 2026; earlier "Latent Studio" was a temporary label) is where work made in the Latent ecosystem is presented. Artists start work in Moment (which can also edit and share directly), finish it in Ritual and Lab, and present it on Studio, a site that stays connected to the apps so it can be updated from inside them. Later: custom domains, publishing from the apps.

## Standard

The templates are the product. They must be rich but elegant and harmonious, in one house (see Folio, `design/folio`). Customisation is a set of designed choices (palette, type pairing, mount, spacing, motion, accent drawn from the artist's work), never free-form sliders, so no combination can look wrong.

## Tiers (to be defined)

- Every tier is equally elegant. Tiers limit breadth and capacity, never quality.
- Free: a limited choice of templates (if there are ten, the free tier has a subset), 20 photographs, no video.
- Higher tiers: more photographs, more templates, more customisation options, video, and later custom domain.
- Implement as entitlements: every option and limit is a named capability, a tier is a list of them, and the interface reads the list. A locked option stays visible with a quiet hint. Counting works and storage must be enforced on a server when one exists.

## Open decisions

- Number and names of templates. Working set of six: Folio, Wall, Reel, Index, Atelier, Passage.
- Tier names, prices and exact limits.
- Which customisations are free and which are paid.

## Editing model (decided 5 October 2026)

Guided composition, not a free canvas and not fixed templates. The artist decides the content and the intent (these photographs, this order, this one is a portrait, these two belong together); the room's rules turn that into a layout that is correct on desktop and phone. Content is separate from layout, so the apps can add work to a site and it sits correctly.

Three levels:

1. **Compose** (default): content flows into designed arrangements. Adding a photograph proposes a few good arrangements to choose from.
2. **Direct**: choose how each piece sits (single, pair, portrait with a note, size) and set the focal point. Still guard-railed.
3. **Free** (higher tier, in one room, probably Wall): place works freely with snapping and guides.

Two layers of customisation: **Look** (palette, type, mount, spacing, motion, accent; built) and **Content and arrangement** (replace, add, remove, reorder, edit words, layout per piece, focal point; Edit mode in Folio is the first prototype).

Open question: whether the rooms render from the existing document model in `src/model.ts` (which already has undo, media, Ritual import, publishing) or grow their own editing. Lean: build on the existing engine; test the fit first.

## Document version 14 (started 5 October 2026)

`src/studio/document.ts` is the new document: the pages and blocks of version 13 (asset, alt text, focal point) with theme tokens and arrangement intent in place of layout geometry. `migrateFromV13` reports anything it cannot express instead of dropping it silently. `toFolioContent` turns a page into what the Folio room renders. Tests: `tests/studio-document.test.ts`.

Folio runs on the document, and saves it. On load it reads the stored document from the browser (seeding it from `design/folio/doc/before-it-disappears.studio.json` the first time); every edit is converted back with `fromFolioContent` and saved with a revision check (`src/studio/store.ts`), so a second tab cannot silently overwrite the first. Added and replaced photographs are downscaled to 2400 px, stored in the media store (a 16 MB original became 949 KB) and shown from there after a reload. Images no longer used are removed on the next load, never mid-session, so Undo stays safe. Add `?reset` to the address to restore the original series.

The browser build of the document and store is `design/shared/studio.js`, generated by `npm run studio:lib`. Rebuild it after changing anything in `src/studio`.

Not yet done:
- The look and words save, but Undo history is in memory only.
- Index has no converter yet, so only Folio is document-driven.
- The plan (Free or Full) is a local preview switch, and photograph limits are enforced in the page only, not on a server.
- The browser build is 453 KB, mostly the validation library. Fine for prototypes; trim before a public release.
- The store uses its own database (`latent-studio-rooms-v14`), not the editor's. It has the same shape, so the editor can be pointed at it later.
- Video is not supported in Edit mode yet.

## Naming (decided 5 October 2026)

- Product: **Latent Wall** (working name). Simple, physical, ties to The Ritual's Studio, which is its wall. Not "Studio": The Ritual already has a room called Studio.
- Templates: Folio (photographers), Index (writers), Salon (painters and visual artists), Reel (filmmakers), Atelier (studios), Passage (image-makers). Interface word: "template".
- Trademark and domain checks not done yet.

## The shared engine (built 5 October 2026)

`design/shared/engine.js` runs any template: loading and saving the document, history, adding and replacing images, the customise panel, plan limits, the edit bar. A template is one small file (`room.js`) that says how its page looks and how its pieces can sit, plus a converter pair in `src/studio/document.ts` (`toFolioContent`/`fromFolioContent`, `toIndexContent`/`fromIndexContent`). Folio and Index both run on it. To add a template: write `design/<name>/room.js`, a converter pair with tests, a seed document and `assets.json`, and the page's CSS.

Edit mode, saving, Undo, plan limits and the customise panel come for free. Preview (`?preview`) hides all controls for use inside the home page.

## Salon (built 5 October 2026)

Painters and visual artists. Works hang together on walls at one scale (pixels per centimetre) and are centred on a common eye line, so a large canvas and a small study keep their proportion. `hang: "with"` hangs a work beside the next; `"alone"` ends the wall; a wall never runs wider than 400 cm. Each work has a real size in centimetres in the document (`size`, optional; 60 cm on the long edge is assumed when absent). A numbered key sits under each wall. Click a work for the viewer (arrows and Escape). On a phone the walls become a column with widths kept in proportion to the largest work. In edit mode a work's size, medium, title and year are edited in the key; editing a width or a height keeps the picture's proportions.

## Browser notes (5 October 2026)

Habib uses Safari. Test in WebKit as well as Chromium (`npx playwright-core install webkit` once; Playwright's WebKit runs in a temporary, private-window-like mode). Found by doing so:
- Safari cannot reliably store file objects in IndexedDB (it refuses them in private windows). Images are stored as raw bytes (`StoredImage`); files stored by earlier versions are still read.
- Percentage heights inside grid cells are unreliable in Safari; the viewer sizes its image with absolute positioning.
- When the look changes, the engine keeps the reader's place (`holdPlace`), measured within 1 px in both engines.

## Reel (built 5 October 2026)

Filmmakers. A dark screen; each film at its own ratio (2.39:1, 2.00:1, 1.85:1, 16:9, 4:3, 1:1; the frame never exceeds 82% of the viewport height). A film is a project page: the first image is the poster, a video block is the film (or only its watch link), later images are stills (open in the shared viewer), text blocks are credits. Year, length and ratio live in the page's `meta` ("2025 · 28 sec · 2.39:1"). Click the play button and the film plays where it stands.

Plans: films (MP4 or WebM, up to 80 MB in this browser prototype) need the Full plan; on Free a film can still be shown with a poster and a link to where it is hosted. Stored films are kept as raw bytes like images, and play again after a reload (checked in Chromium and Safari's engine).

Demo content: a 28 second, silent, 2.39:1 sample made from the Lebanon photographs with ffmpeg (`design/reel/media`), clearly labelled as a sample. A personal talking-to-camera video on this Mac was deliberately not used.

Not done: real video hosting and streaming (needs a server), captions/subtitles, audio-led films, trailers autoplaying on the home page, poster generation from the film.

## Atelier (built 5 October 2026)

Studios and designers. Each project is a project page: the images marked `role: "process"` are its steps, in order (labelled by `title`, described by `caption`); the other images are its outcome; text blocks are its facts ("Role: ..."). The lead outcome is pinned beside the process while the steps scroll past; further outcome images follow in a row. If the first step hangs with the next (`arrange: "with-next"`) it is set against the lead outcome in a comparison slider (drag, or arrow keys). On the about page, text blocks marked as a pause are the studio's principles, set large and numbered. On a phone the outcome comes first.

Demo content: three made-up projects (a bakery identity, a book, an exhibition poster) with 13 images built by rule (type, grids, colour, compositions) by `design/atelier/tools/make-images.mjs`. Rule-built because code cannot draw organic things (see the earlier lesson), and a studio's process work is largely constructed anyway.

## Where things stand (5 October 2026)

Five templates are built and live on the home page: Folio, Index, Salon, Reel, Atelier. Passage (image-makers and collectors) is the sixth, in design. All run on the shared engine, save to the browser, and are tested in Chromium and Safari's engine.

## Looks: layout is the template's, personality is the look (5 October 2026)

Habib's note: the five templates were different layouts but felt like one person's identity (same type, same soft palettes, same headline treatment). Latent's taste should show in craft and standards (proportion, rhythm, readability, calm), not in one visible style, so people building on Latent do not end up with the same website.

So a **look** is a whole art direction applied over any layout: type, colour, headline style (size, case, tracking, how the emphasised word is set), label style, line weight, shape (corner radius), image frame, texture, and some structure (centred or left header, nav as pills or boxes). A template is layout only.

Built as a proof on Folio: six looks (`design/shared/theme.js` LOOKS; structural rules in `design/shared/looks.css`): Quiet (Latent's own; the existing palette and type pickers apply only here), Swiss, Darkroom, Zine, Gallery, Soft. The look is saved in the document (`theme.look`), chosen first in Customise, limited by plan (Free: Quiet and Gallery), and can be forced by a link (`?look=zine`).

Guard: `tests/looks.test.ts` fails any look whose body text is under 7:1, secondary text under 4.5:1 or accent under 3:1 contrast (it caught Gallery's and Soft's first colours).

Not done: the other four templates still use their own copy of the old styles, so only Folio supports looks so far. Next: move Index, Salon, Reel and Atelier onto the same settings, then add more looks and more dials (voice, weight, contrast, density, sharp or soft), palettes drawn from the artist's own work, and bring-your-own font/logo/colour as a paid feature. Passage and further layouts should not share the same opening skeleton.

## Four layers of customisation (decided 5 October 2026)

Habib: templates should be customisable inside their own foundation, and looks could be exclusive to a template, not only shared.

1. **Foundation**: the one idea that makes a template itself and cannot be turned off (Folio: one work at a time held still; Salon: true relative scale; Reel: a screen at the film's ratio; Index: words with a contents rail; Atelier: process beside outcome).
2. **Template options**: a few choices (at most three) that rearrange it within that identity. Declared in each template's `room.js` (`options`), shown in Customise under "This template", saved in the document (`theme.options`), applied as `data-opt-<key>` attributes that the template's `looks.css` styles. Folio: caption (below, beside, hidden) and picture size. Index: contents (left, right, top) and poems (flush, centred). Salon: wall (tinted, white, dark) and key (under, hidden). Reel: stills (row, grid) and words (beside, below). Atelier: outcome (right, left) and process (list, filmstrip). On a small screen options give way where they would not fit; editing always shows what a viewing option hides.
3. **Looks**: eleven in all. Six shared (Quiet, Swiss, Darkroom, Zine, Gallery, Soft) and one exclusive to each template: Proof sheet (Folio), Paperback (Index), Plaster (Salon), Cinema (Reel), Blueprint (Atelier). A look is registered in `design/shared/theme.js` (`only: [templates]` makes it exclusive); structure that settings cannot express goes in `design/shared/looks.css` (shared) and `design/<template>/looks.css` (that template's options, its exclusive look, and what the shared looks need there).
4. **The artist's content** and small dials.

**The editor never wears a look.** Its bar, toolbars, add marks and Customise panel use their own fixed tokens (`--ed-*`, set by the site's brightness in `theme.js`), so they stay readable on any site.

**Small accent text** uses `--peony-text`, a stronger version of the accent computed to read at 4.6:1; the accent itself only has to read at 3:1 for large type.

### The matrix (`npm run matrix`, `npm run matrix:quick`)

`scripts/matrix.mjs` opens every template in every look it offers with every combination of its options, at desktop and phone size, in Chromium and Safari's engine, first to read and then to edit. Reading: no errors, nothing wider than the screen, all text at its contrast threshold, the picture viewer fits and locks the page. Editing: the bar and panel stay on screen, the editor's controls read at 4.5:1, words can be typed and are saved, the template's own control works, Customise opens, keeps its place and changes the look. It found real problems the first time it ran (editing impossible on a phone in Salon; a toolbar widening Index; options forcing columns on a phone; small accent text under threshold), and runs only against `http://127.0.0.1:5181` unless `--base` says otherwise. Needs `npx playwright-core install chromium-headless-shell webkit`.

## The artist's accent works in every look (5 October 2026)

Habib noticed the accent swatches did nothing in most looks: each look carried its own fixed accent and ignored the artist's. Now `theme.accent` is `null` (use the look's own) or a colour that wins in every look. `accentFor()` in `design/shared/theme.js` moves the chosen colour toward black or white by the smallest amount needed so that: it reads on the look's ground (3:1, for large type and graphics), small accent text reads (`--peony-text`, 4.6:1), and, for looks that put text on an accent fill (Swiss, Soft, Zine), that text reads on it (`--on-accent`, 4.5:1). Customise shows the look's own accent first, then the curated colours, each drawn as the colour it will really become; a link can try one with `?accent=2F6FEB`.

Tests: `tests/looks.test.ts` runs nine awkward accents (bright yellow, deep navy, pink, teal, white, black, grey, green, the old pink) through all eleven looks. The matrix loads every combination with a yellow and a navy accent, checks contrast and overflow, and checks that choosing an accent visibly changes the page.

## Image size (decided 5 Oct 2026)
- Cap per image: 15 MB, any common format (JPEG, PNG, WebP, HEIC). Advise it in the picker: bigger files make the artist's own editing slow too.
- Visitors never receive the upload: sized copies (about 800 / 1600 / 2800 px), loaded as they scroll. Needs a server, so it belongs with release work.
- Free and Full plans differ in total storage and photo count, not in the per-image cap.

## Stage 1: the whole site (started 6 October 2026)

Habib's aim: get the hassle and clutter of other builders out of the artist's way. Beautiful without effort, yet free enough that every portfolio shows its artist's whole identity, never a shared one.

Decided: one site holds every kind of work (photograph stories, writing, films, works at true scale, projects with process). A template becomes a **house**: it sets the front-page forms, the arrangements its pages may use and its exclusive looks. **Edit** is the site and its content (pages, order, arrangement, words); **Customise** is the artistic choices (look, palette, accent, type, spacing, motion). The studies that settled this are in `design/_explore/ways` and `design/_explore/site` (with scripted sweeps in `design/_explore/site/tests`).

**Document version 15** (`src/studio/site.ts`, tests in `tests/studio-site.test.ts`):
- a **library** of works: a photograph's own facts (title, date, medium, alt text, focal point, real size) live once; pages refer to it, so one photograph can sit in several stories and work from the apps lands in the library first. A film still's line belongs to the film, not the photograph.
- **pages** with a kind (story, writing, film, project, about, contact) and their own address; a story chooses its arrangement (held, book, passage, contact, wall, slides).
- a **front page** with its form (covers, list, sheet) and words; the **theme** as in version 14.
- rules: no two pages at one address, no page referring to a work the library lacks, no geometry anywhere.
- `migrateFromV14` turns each template's document into a site and names in a report anything it cannot carry; `openSite` reads either version. All six seeds migrate with an empty report and every work placed.

Next: the renderer and routes (front page in its forms, a page per address, navigation from the pages), then Folio's arrangements on it, then the Edit and Customise panels, then the looks and the matrix across houses, page kinds and arrangements.

## The app (6 October 2026)

`app/index.html` with `src/app`: one app for the whole site, replacing the six templates.
- `render.ts`: every page kind (story, writing, film, project, about, contact) and every arrangement (held, book, passage, contact, wall, slides), the front page in its three forms, navigation from the pages, "next" at the end of each page. A site with one piece of work opens straight onto it.
- `behave.ts`: turning, walking, holding, slides, the wall's scale, film play, the comparison; each view keeps its place across redraws; keys never act while typing.
- `ops.ts`: every edit as a pure function on the site (tests in `tests/app-ops.test.ts`).
- `store.ts`: the site and photographs in this browser, with a revision on every save and other windows following along. Samples play in their own spaces (`?site=folio`, …), never in the artist's.
- `edit.ts`: **Edit** (This page / The site: words, arrangement, works tray, pages, add each kind, the library) and **Customise** (look, accent, and under Quiet: light, palette, type; mount, spacing, reading size, motion). Words are typed on the page; each work has a toolbar; a + sits in each gap.
- Browser tests: `tests/browser` (every page of every sample; a whole editing session; both engines).

Not yet: Publish, plans, video upload for films, the matrix across looks × arrangements; then the old templates and the studies are deleted.

## Learning from Squarespace and Format (6 October 2026)

Habib: in design and templates we can do better, being made for art (photography and film first); in customising, editing and setting things up they have long experience, and we bring what we need into our workflow. A research pass (their help centres, tutorial sites, reviews; complaint evidence is directional) gave this.

**To bring in, in this order:**
1. **Draft, then Publish.** Squarespace saves straight to live and people work around it. Ours: editing is always a draft; Publish lists what changed and gives a private preview link.
2. **Restore an earlier publish.** Every published version kept; "restore the site as of 3 Oct".
3. **Replacing a photograph keeps everything** (caption, focal point, every story it sits in). Later: a Lightroom plug-in that really syncs (Format's is loved; Adobe's manual "Reset" is what to avoid).
4. **The library as the single source,** "used in" on each work (built).
5. **Drop a folder, get a story,** ordered by file name or capture date, then reorder.
6. **Captions and dates read from the file** (IPTC/EXIF) on import.
7. **One focal point per work, used everywhere:** covers, contact sheet, share image, phone crops.
8. **Share image and search preview per page,** filled from the page's own words and cover, editable, in a quiet "How it appears" area.
9. **Visibility:** site and page passwords, a "coming soon" mode; hidden pages reached by link (built as "hidden").
10. **Films:** host or embed (Vimeo, YouTube) with the artist's own poster; never charge filmmakers by the minute.
11. **Trash for pages,** restorable for 30 days.
12. **Phone:** preview toggle in Edit now; later, content editing on the phone (upload, order, captions, publish), Customise stays on desktop, which mirrors our Edit/Customise split.
13. **Later:** a proofing room for clients (password, favourites, download sizes), a words-only role for an assistant or gallerist, few-question onboarding that turns a dropped folder into a finished first site, guided domain connection with live checks.

**Never repeat:** saving means live; platform versions that strand work or forbid changing the design; building the phone layout twice; tools that work in one page kind but not another; small tiered video limits; photo or project caps and stored images capped at 2500 px (keep masters, serve sizes); billing and support that break trust; sync you trigger by hand; no bulk export.

## Distinct templates, deep freedom inside (6 October 2026)

Habib: Squarespace and Format have really distinct templates, and inside each a lot of customisation and freedom; ours were one skeleton in different looks, so artists would look alike.

Now: the skeleton is a set of designed choices in the theme (`header`: classic, centred, stacked, side column, name only; `opening`: words, an image, the name, straight into the work; `title`: accented word, one voice, small and quiet, capitals; `captions`: under, beside, when pointed at, hidden; `footer`: a line, the name large, almost nothing; `scale`: intimate, standard, monumental), plus `typeface`: twelve pairings that can be changed under any look. A **template** (`src/app/houses.ts`) is a distinct starting set of these with a look, a typeface, a front form and how new stories arrange: Folio, Gallery, Monograph, Passage, Reel, Salon, Index, Atelier, Lantern. No two share a skeleton (tested). Choosing one never touches content. Customise is grouped: Template, Look and colour, Type, Structure, Details.

Board: `design/_explore/templates/` (the same site in all nine, front, a story, the poem, About, phone).

**The split, decided by Habib (6 October 2026):** "the template is us helping people to decide instead of flooding them with decisions; inside the template we can still give them a rich experience in customising." So each template in `src/app/houses.ts` declares what it decides and what it offers: its arrangements, its front pages, two or three variants of each skeleton part (the first is its own), the looks and typefaces made for it. Customise and Edit show only those; every edit refuses anything else (`ops.setTheme`, `setArrangement`, `setFront`); a site is brought within its template when opened (`conform`). Changing template is the big decision; a story whose arrangement the new template does not offer takes the template's own, and the artist is told.

**Templates keep their promises (6 October 2026).** Habib asked to make sure each template really does what we say, and that "who it's for" matches what it is. An audit with the same site in all nine found Reel opening on a photograph, Index leading with photo stories, Passage's front page vertical, and Salon and Monograph keeping other arrangements (switching template kept a story's arrangement). Now: a template decides every story's arrangement; each declares what kind of work leads its front page and menu (`leads`, `menu`: Films, Writing, Projects, Contents, Works); Passage's front page is a walk; Monograph is spreads only with a Contents page; Salon gives every work its dimensions; Reel opens on the first film's still. `tests/app-templates.test.ts` holds each template's promises as checks against the rendered site. The home page and board take their words from `houses.ts`.

## Clean-up and Publish (8 October 2026)

The old templates, the shared engine, the studies, the matrix and the v14 document and store are gone; the app is the product. `design/shared` keeps only the looks (`theme.js`, `looks.css`), `base.css` and the viewer; the photographs stay where the samples point. The exclusive looks' structure lives in `src/app/looks.css`. `scripts/sync-to-site.mjs` is disabled: the copy already live at `/wall` on the site is left alone until Publish replaces it.

**Publish** (`src/app/publish.ts`, `versions.ts`, `pubpanel.ts`): editing is always a draft. The Publish panel shows the address the site will live at, what changed since the last publish in the artist's words (new, removed, renamed and changed pages; works' words; the look, type, colour, structure; the front page), checks that stop or warn (no name, no work, empty pages), then Publish. Every version is kept in this browser (`latent-wall-versions`): open it as a visitor would (`?published`, `?published&v=N` as the private preview link), download it as files, or put it back as the draft. The files: a complete html page per address with the theme on the root element, the assets, the photographs, and `app/visitor.js` (built by `scripts/build-visitor.mjs` from `src/app/visitor.ts`, 21 KB, no schema library) which wires turning, walking, holding, slides and film on a page that is already drawn. Hosting the files at the address is Stage 2.

**From the computer (8 October 2026).** `src/app/meta.ts` reads what a JPEG says about itself before it is sized: the headline (or title), caption, by-line and the moment taken, from IPTC, XMP and EXIF; what the artist wrote in Lightroom wins over the camera. A work joins the library with that title, caption (kept as alt text too) and date. **A story from a folder** (The site → "+ A story from a folder", or a folder dropped anywhere while editing) arrives in the order taken, then by name, named after the folder; files dropped on a story join it. **Replace** on a work's toolbar or in the tray swaps the picture everywhere it appears and keeps its title, caption, date, focal point and size (`ops.replaceWork`). The old picture's bytes stay in the browser's store until a later clean-up. Not yet: HEIC metadata, video files, a sequencing view.

**Colour from the work (8 October 2026).** `src/app/colour.ts` reads the artist's photographs (small, on a canvas) for the colours that would hold as an accent: distinct, with some saturation, neither paper nor shadow; across the library the colours that recur come first. Customise shows them under "From your work" beside the curated accents; the look's own fitting makes each read on its ground. First real result on your photographs: ochres, olive greens, a sky grey-blue, a deep red.

**Trash and phone preview (8 October 2026).** A removed page goes to the trash (`site.trash`), listed under The site with Put back and Delete for good; it keeps its works in the library and comes back at the end of its kind under a free address; thirty days on it is gone (`expireTrash`, run when a site opens). Publish never carries the trash. **Phone** in the bar shows the site as it is now in a phone-sized frame, which follows every save.

**How it appears, the mark, the focal point (8 October 2026).** Each page (and the site) has an `appears` block: a title and description for search results and a share image for links, empty meaning "from the page itself" (`render.appearsOf`); the panel shows them as a search result and a share card. `site.mark.logo` shows a logo or wordmark in place of the name. A work's focal point is set by pressing on the picture (`setFocal`); the opening image and the share crops keep it in view. Published files carry title, description, og tags, a favicon (the artist's initial on the site's ground, in its display face) and 1200 × 630 share images, one per distinct picture.

**Turn it over (8 October 2026).** Every work has a back, like a print's verso: where it was made, a line in the artist's hand, its edition, and how it was made (`work.verso`). A small corner control on the picture turns it over, in every arrangement (held, book, passage, contact, wall, slides) and in the published files; the control is offered to visitors only when something is written there, and always while editing, where the back is written in place. A turned work stays turned through an edit. Empty lines are not shown. Designed as the quiet counterpart to the caption: the front is the work, the back is its provenance.

**The door (8 October 2026).** Who can see the site is one choice on The site tab: everyone, those with a word, or no one yet. A page can also stand behind its own word (its Address block). A visitor meets a door: the title, one line, the word, Open; a word is forgiven its case and spaces and is remembered for the session. "No one yet" publishes a holding page (the name and a line; with a word, the door too), so the site can be announced before it opens. The published files are static, so privacy there is honest rather than pretended: a page behind a word is sealed (`src/app/lock.ts`: PBKDF2 → AES-GCM) and carried inside its own door file; nothing of it is readable, its photographs travel under unguessable names that only the opened page knows, the open pages' documents carry no words and nothing of it (`publish.publicSite`), and no share image is made for it. `visitor.js` opens the page in the browser when the word is given. The editor always sees everything; Publish names what stands behind a word before it goes out.

**Life size (8 October 2026).** A work's real size is set in its tray row (Real size: one side given, the other follows the picture; `ops.setSize`). The Salon already hangs works at their relative size; now any work with a real size can be seen at life size in the viewer (`design/shared/viewer.js`, shared with the published files): as many screen pixels as it is centimetres, the stage scrolling when it is larger than the screen. Screens do not report their true scale, so the viewer learns it once: "Not quite? Match a card" shows the outline of a bank card (85.6 × 53.98 mm) and a slide until it matches a real one; the scale is kept in that browser (`latent-ppcm`). Works without a real size are not offered it.

**The record (8 October 2026).** A seventh page kind, added from The site tab: a statement and the dated lists an artist is asked for (exhibitions, publications, awards, collections, education, press), each a section of year-and-text entries, newest first by custom but in the artist's own order (`ops.addSection/addEntry/moveEntry…`). It sits in the menu with About and Contact, reads as the words layout with the lists beneath (year in a margin), and goes out in the files like any page. Publish warns when it is empty.

**Sequencing, and letting go (8 October 2026).** A story's tray rows drag into order (`ops.reorder`): the lifted row fades, the landing place is marked above or below the row under the pointer, the drop is one change (Undo takes it back); the arrows stay for the keyboard. Photographs nothing refers to any more (a replaced picture, an upload deleted from the library) are let go from the browser's store on the next load, never mid-session, so Undo within a session stays whole; what any site in this browser or any published version still refers to is kept (`store.sweep`, `versions.everyVersionAsset`).

**A first story on the start page (8 October 2026).** Starting a site can begin with the work: under the name, a folder of photographs can be chosen or dropped; Make my site brings it in (the one way in, `src/app/bring.ts`, shared with the editor's library, folder and drop), makes the first story named after the folder in the order taken with the files' own words, and opens the site on it in the template's own arrangement. Without a folder the site starts empty as before.

**The film file (8 October 2026).** A film page takes its own file (The film: an MP4, MOV or WebM up to 400 MB, `store.putVideo`): kept as it is, measured by the browser, placed in the library as a film with its length as the caption, set to play on the page over the poster, the page's ratio following the picture; the link stays as the other way. The file travels whole in the published files and plays from disk. Filmmakers are never charged by the minute.

**HEIC (8 October 2026).** An iPhone's own files say the same things in another container: the Exif and XMP sit as items in the HEIF index, and `meta.readMeta` now finds them (iinf for the items, iloc for their bytes), so a HEIC brought in on Safari arrives with its title, caption and the moment taken like a JPEG. Chromium cannot decode HEIC pictures; it says so, and loses nothing.

## Where things stand (8 October 2026, evening)

Built, each with its unit tests and a browser sweep in Chromium and WebKit, one commit each: draft → Publish with every version kept and restorable; files from the computer with their own words, a folder as a story, Replace keeping everything; colour from the work; trash; the phone preview; how pages appear, the mark, the focal point; turn it over; the door (a word on a page or the site, "soon", sealed files); life size; the record; sequencing by drag and the letting-go of forgotten bytes; a first story on the start page; the film file; HEIC. Fifteen sweeps, `tests/browser/README.md`.

Next is Stage 2, which needs decisions and a server: accounts; hosting the published files at `name.latent.site` and the artist's own domain; the image pipeline (masters kept, sizes served); plans as entitlements and their limits. Then a proofing room for clients, a words-only role, the Lightroom plug-in.

## The pass before the promise (9 October 2026)

Habib, on the home page's promise ("no two artists alike", "every kind of artist"): it requires a full pass on what was built: ownership and contracts clean and clear, everything readable, the same identity by day and by night; "we are competing with giants; we cannot be less than state of the art". The contracts are in `docs/CONTRACTS.md`. Two audits now measure what the page claims (`tests/browser/README.md`, Audits).

**Found, and fixed the same night.** (1) Night only existed for the quiet look: every other look carried a fixed scheme, so Day / Night did nothing under them, and the published files ignored the mode, the palette and the artist's accent entirely. Now every look has its other half (`night` for the day looks, `day` for the night looks: the same art direction with the lights changed; `design/shared/theme.js`), Day / Night / Follow the device stands under every look, the few fixed colours in the looks' CSS follow the scheme (`[data-scheme]`), and a published page carries its colours for the first paint (both halves when it follows the device) and then applies the theme as the app would. `tests/looks.test.ts` holds every half to the same contrast as the look itself. (2) The range audit, honest after its seam was corrected, showed Folio with real range (median distance 0.41, no near-twins of 276 pairs) and Monograph (0.036, 85 near-twins), Lantern (0.068, 76) and Passage (0.118, 45) without: their looks were paper tones of one another and their skeleton choices barely show on a spread or a slide. Every template now offers at least six looks, day and night natives among them, and at least five type pairings; the measure is re-run with night included.

**Still to do for the promise.** Dials that show on a spread and a slide (Monograph, Lantern); more templates where an artist has only one (painters, writers, filmmakers, studios), each a different mechanism, not a reskin: Journal, Sheet (photographers); Studio, Catalogue (painters); Chapbook, Column (writers); Cinema (filmmakers); Ledger (studios); Pinboard (illustrators, printmakers); Archive (mixed work). Then the home page's words from the artist's side.

**Nine more templates (9 October 2026, overnight).** Eighteen now, two to three for every kind of artist, each with its own mechanism rather than a reskin: **Journal** (photographers who shoot every day: dated entries newest first, each story a day), **Column** (essayists: writing dated, listed newest first), **Catalogue** (painters and estates: every work numbered through with medium, dimensions and year), **Chapbook** (poets: the front page is the reading itself, one piece after another, set large), **Cinema** (filmmakers: a poster wall at each film's ratio, dark by nature), **Ledger** (studios and architects: a table of projects, clients, disciplines, years; no pictures until the page), **Pinboard** (illustrators and printmakers: a new arrangement, `board`, many works pinned close at their own proportions, the larger ones across two), **Studio** (painters who show the making: boards for work in progress, walls at true size for the finished, process beside outcome), **Archive** (artists whose work takes many forms: everything by date, sifted by kind). Six new front forms (journal, catalogue, reading, posters, ledger, archive) and one arrangement carry them; every template's promises are checked in `tests/app-templates.test.ts`, every choice in every arrangement in `tests/app-choices.test.ts`. Dark-room templates (Passage, Reel, Cinema) open at night by their own decision (`details.mode`). The old home page still lists nine; the new one takes its list from `houses.ts`.

**Measured, 9 October 2026, morning.** Day and night: 120 surfaces (eighteen templates × front, story, About; the editor, Customise, Publish, the start page, the home page), 0 contrast failures, every render in the mode asked for. Range (24 combinations per template, night included): Folio 0.47, Gallery 0.16, Monograph 0.66, Passage 0.12, Reel 0.33, Salon 0.66, Index 0.51, Atelier 0.21, Lantern 0.14, Journal 0.38, Column 0.42, Catalogue 0.47, Chapbook 0.19, Cinema 0.21, Ledger 0.37, Pinboard 0.25, Studio 0.42, Archive 0.37 (median distance; before the night's work Monograph was 0.04 and Lantern 0.07). Passage, Lantern and Gallery still need choices that show where one picture fills the page. Catalogue, Chapbook and Archive now open in etching, toned paper and graphite so their defaults stand apart from Journal and Column. The morning report: `design/_explore/report/index.html`.

**Nothing that does nothing (9 October 2026, the morning after).** Habib: "how can we make sure each setting or option is doing something the user sees? I feel there are things that change nothing"; and "some templates deserve more looks". A new measure, `scripts/visible.ts`, presses every Customise choice and every "how it sits" option on every page an artist edits, in every template, and compares the page as pixels (its first two screens and its foot): a choice that moves the page by less than the eye registers is listed as silent *there*. The first honest run (2,253 presses) found the real gaps: Reading size reached only writing; the accent was offered on pages where nothing wears it; the front page's opening, a story's captions and scale, a page's footer were offered on pages that cannot show them; a changed work in a book or a slide show stayed off-screen. Now: reading size reaches every kind of prose; the Accent block appears only where an accent can be seen (an accented title word, or a look that paints with it) and otherwise says how to get one; a choice that cannot show on this page says so and offers to go where it shows (opening → the front page; captions, scale, spacing, mount → a story; footer → a page with a foot) instead of changing nothing here; scale reaches slides, boards, books and the poster wall; after a change to how a work sits, the book or the slides turn to it and the page scrolls to it; Monograph no longer offers a caption position its spreads cannot show. Choosing a look now brings its own type (the artist may change it after), and the look's own pairing is allowed in every template.

**Looks of their own (same day).** `scripts/looks-board.ts` renders every template × every look × day and night (`design/_explore/looks/`). It caught Monotype's day as a second Graphite (now a warm mid-tone, the ink-wash side of the plate) and five kinds of artist without a look made for them. Added, each only for the templates it is for: **Marquee** (Reel, Cinema: red velvet, gilt, a Bodoni bill), **Silver screen** (Reel, Cinema: silver and black, a Deco face, the still desaturated), **Riso** (Pinboard, Studio, Atelier: two inks on newsprint), **Typewriter** (Chapbook, Column, Index: Courier, a ragged margin, one red ribbon), **Gesso** (Salon, Studio, Catalogue, Pinboard: chalk white, charcoal, one red ochre). Twenty-two looks, every one with a day and a night.

**Measured to the end (9 October 2026, afternoon).** Four runs of `scripts/visible.ts`, fixing between each: 992 silent presses → 137 → 37 → **8** of 1,457, and the eight that remain are either by nature (reading size on a board whose captions appear only when pointed at) or below the measure's own threshold while real to the eye (a two-line note growing from 17 to 19 px). Along the way the measure itself was corrected twice (translucent grounds, `color(srgb …)` values, a full-page capture that stretched the viewport and froze everything sized in vh). The last fixes: hairline mounts that stay inside frames that clip (slides, spreads, sheet cells); mats as padding where a shadow would be clipped; the walk scrolling to its first work when a choice that shows on works is made; the book's captions following the reading size; the sheet's gaps following the spacing; the covers' rhythm following the scale, so scale shows even where a narrow window caps their width; the mount reaching the walk's covers; and the mount not offered on fronts without pictures (a ledger, the reading).

**State of the art in every aspect (9 October 2026, afternoon).** Habib: "let's make this state of the art in all of its aspects". Each aspect measured, then fixed. **The arrival:** the working home replaced the brochure (`design/home/index.html`): the true count is 378,080 designed ways (eighteen templates, the look's own type counted, day and night counted; before accent, palette, spacing and mount), the five moments are written from the artist's side ("You already sequenced it. In Lightroom, last night."; "A collector asks what paper it is on."; "The series is not ready. The gallery is."; "A sixty-centimetre print is sixty centimetres."; "Change your mind without losing a thing."), and the eighteen are a list by kind of artist with one running beside it, not a catalogue grid. **The phone:** the pages sweep walks every template's front, story and About at 390 px: no overflow, no broken image; found and fixed: the demo note covered the site's header on phones, the poster wall left a single film tiny. **The hands and the ears** (`tests/browser/hands.mjs`): 54 pages tabbed through, every stop visible with a focus ring, every picture with alt text, every button and link named, landmarks present; found and fixed: captions and slides still moved under reduced motion (now nothing in a site animates when stillness is asked for). **Speed** (`scripts/speed.ts`, on the dev server): median largest paint 336 ms, median image weight 948 KB per page, no long tasks; one layout shift of 0.29 on Atelier's front from a late web font swap (Archivo), the others ≤ 0.03. Next for speed: self-hosted fonts with metric-matched fallbacks (no swap shift), and sizes served per width (srcset) in the published files.

**The site's own faces (9 October 2026).** The thirteen families (SIL Open Font License) are kept with the product (`design/shared/fonts/`, latin, woff2, 1.3 MB in all) and declared in `design/shared/fonts.css`, with a fallback face for each whose metrics are matched to the real one (size-adjust, ascent and descent overrides, measured in the browser against Georgia, Helvetica Neue or Courier New), so text keeps its place while a face arrives. The app, the home page and every published site load `fonts.css`; the published files carry the faces (`assets/fonts/`), so a site depends on no one at load and the only layout shift the speed measure found is gone. Every type stack names the fallback after the face.

**Sizes per width in the files (9 October 2026).** Publishing now makes each photograph at 640 and 1200 px beside the full one (up to 2400), in the app with a canvas (`Sources.sizes`), and every picture in the files asks for them by width (`srcset`/`sizes`), including the figures the visitor script redraws (books, slides, sheets) and the pictures behind a door under their unguessable names. A phone fetches a phone's picture. Without a maker of sizes (tests, other runtimes) the files carry the full pictures alone, as before.

**The last layout shift (same day).** Atelier's front shifted 0.28 at first paint: its title is Archivo 700 at 10vw, and even a fallback matched per weight lands on a different line break at that size. The faces are local and small, so they now block briefly instead of swapping (`font-display: block`): the title is painted once, in its own face.
