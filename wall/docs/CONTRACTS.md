# Latent Wall: who owns what

The product makes one promise to an artist: *your site is yours, it cannot look like anyone else's, and nothing you choose can go wrong.* That promise is only as good as the contracts beneath it. This page states them in plain words, says where each lives in the code, and which test holds it. If a contract and the code disagree, the code is wrong.

## 1. The document owns the work and the intent

The site document (`src/studio/site.ts`, version 15) is the artist's. It holds:

- **the library**: every work once, with its own facts (title, date, caption, alt text, focal point, real size, the back of the print);
- **the pages**, each of a kind (story, writing, film, project, record, about, contact), with its own address, words, and for a story its pieces and arrangement;
- **the front page's** form and words;
- **the theme**: the look and the artist's choices under it;
- **the door** (who can see it), **how pages appear**, the **mark**, the **trash**.

It never holds geometry (pixel sizes, positions, colours of a look). A document can be opened by any template; changing template never touches a work or a word (`ops.applyHouse`; `tests/app-ops.test.ts` "changing template keeps every work and word").

Held by: `siteSchema` (strict, every reference checked: no page may name a work that is not in the library, no two pages share an address), `tests/studio-site.test.ts`.

## 2. A template decides; it does not own the work

A template (`src/app/houses.ts`) is a set of decisions made for a kind of artist, so they are not flooded with them. It declares, and only these:

| It decides | Field | What it means |
|---|---|---|
| what leads | `leads`, `menu` | the kind of work first on the front page and in the menu |
| how stories are shown | `arrangements` | the first is its own; a story may use any listed |
| its front page | `fronts` | the forms offered; the first is its own |
| its skeleton | `dials` | 2–3 variants of header, opening, titles, captions, footer, scale; the first is its own |
| its looks and type | `looks`, `typefaces` | made for it; nothing outside the list is shown |
| its signature | `owns` | one line: what makes it itself |

A template never changes content, never makes anything up, and cannot be turned into another template: every choice the artist makes must be on its lists (`ops.setTheme`, `setArrangement`, `setFront` refuse what is not offered; `conform` brings a site within its template when opened).

Held by: `tests/app-templates.test.ts` (each template's promises checked against the rendered site: Reel opens on a film, Index leads with writing, Monograph is spreads only, Salon gives every work its dimensions, no two templates share a skeleton), `tests/browser/promises.mjs` (the thumbnail is the template you get).

## 3. A look owns colour and voice, nothing else

A look (`design/shared/looks.css`, `src/app/looks.css`) owns: the ground and ink, the accent's fitting, the type pairing when the artist has not chosen one, the frame and mount styling, the feel of motion. It owns no layout. A look must read by day and by night, and every look must hold the artist's accent (`tests/looks.test.ts`, `tests/browser/night.mjs`).

Looks are exclusive to templates (a template lists the looks made for it). The editor itself never wears a look: the panel and dock are one quiet instrument in every site.

## 4. The artist owns every choice shown, and every choice does something

Everything the panel shows is the artist's to change, and every choice must visibly change the page. No option is ever shown that does nothing in the arrangement at hand (`tests/app-choices.test.ts`: every arrangement choice in every template changes the render; `tests/browser/customise.mjs`: every Customise choice pressed on every sample site, failing if one changes nothing).

Editing is always a draft; Publish is the only way out, and every published version is kept (`src/app/versions.ts`). Undo is always there. Nothing is deleted for good without being asked: removed pages wait thirty days; works leave the library only when the artist asks; their bytes are let go only on a later load.

## 5. Visitors are owed the same identity by day and by night, and honest privacy

A site must be itself in both modes (`theme.mode`: day, night, follow the device), with every piece of text readable (`tests/browser/night.mjs` checks contrast). A page behind a word is sealed in the published files, not merely hidden (`src/app/lock.ts`, `tests/app-door.test.ts`).

## 6. The numbers we say must be true

"79,328 designed ways" is computed from `houses.ts` (looks × typefaces × skeleton variants × arrangements × front forms, summed over templates), before accent, palette, mount, spacing, motion and scale. Whether those ways are *visibly* different is measured, not assumed: `scripts/distinct.ts` renders many valid combinations per template and reports how alike they look (`design/_explore/audit/distinct.json`). A template whose combinations look alike has range to add, or a number to lower; the page never says more than the measure supports.

## 7. Words

Every label and hint in the editor is written to the artist, in plain words, about their work ("Behind a word", "Turn it over", "A first story"), never about the system. Nothing says "still being decided" to a visitor.
