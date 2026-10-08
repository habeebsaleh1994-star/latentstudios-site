# Browser tests for the app

Run against the dev server (`npm run dev`), with Playwright's Chromium and WebKit. Create `/tmp/wall-shots` first; screenshots land there.

- `node tests/browser/pages.mjs chromium|webkit`: every page of every sample site, desktop and phone: no errors, no broken images, no sideways overflow.
- `node tests/browser/edit.mjs chromium|webkit`: a whole editing session: typing in place, toolbars, the works tray, the library and uploads, all six arrangements, every page kind, Customise, saving, and two windows editing one site.

- `node tests/browser/customise.mjs chromium|webkit`: presses every Customise choice (every look, accent, light, palette, type, mount, spacing, size, motion) on every sample site and fails if one changes nothing on the page.

Alongside them, `tests/app-choices.test.ts` (in `npm test`) walks every arrangement, work and Arrange choice of every sample story and fails if a choice changes nothing.

All print `all ... passed` or the failures. Run all of them before showing any change.
- `node tests/browser/panels.mjs chromium|webkit`: every panel (Customise, templates, Edit this page, Edit the site) in every template fits at three widths: nothing runs past its edge or scrolls sideways.
- `node tests/browser/promises.mjs chromium|webkit`: every template's thumbnail on the home page is the template you get from "Try", on a light and a dark device, and a reload brings back the template.
- `node tests/browser/start.mjs chromium|webkit`: a site starts from nothing (choose a template, give a name); no sample work is made up; demos say they are demos.
- `node tests/browser/publish.mjs chromium|webkit`: publishing the whole way: the draft lists what changed, Publish makes a version, the published site opens without the editor, the files download and open from disk (look, photographs, relative links, a book that turns), an earlier version is put back.
- `node tests/browser/files.mjs chromium|webkit`: a folder becomes a story in the order taken, with the titles, captions and dates from the files; dropped files join the story at hand; Replace keeps a work's place and words. Needs `/tmp/wall-shots/Joun autumn` holding 7.jpg, 8.jpg and 12.jpg from design/folio/img.
- `node tests/browser/appears.mjs chromium|webkit`: a page's description and share image, its focal point, and the site's logo, set in the editor and carried into the published files (tags, favicon, 1200 × 630 share images).
- `node tests/browser/verso.mjs chromium|webkit`: a work's back (place, a line, edition, how it was made) is written in place while editing, offered to visitors only when something is written, turns over on the published site.
- `node tests/browser/door.mjs chromium|webkit`: a page behind a word, the site behind a word, and "no one yet": set in the editor, met at the door in the draft and the published view, and in the files from disk, where the page is sealed and opens with the word.
- `node tests/browser/life.mjs chromium|webkit`: a work's real size from the tray (one side gives the other); the viewer shows it at life size, scrolls when larger than the screen, learns the screen's scale from a bank card and keeps it.
- `node tests/browser/record.mjs chromium|webkit`: a Record page is added from the site tab, its statement and sections written in the panel (entries added, moved, renamed, removed, undone), read on the page and in the published site.
- `node tests/browser/sequence.mjs chromium|webkit`: tray rows dragged into a new order (the landing place marked, a drop on itself changing nothing, Undo taking it back); after a Replace, the old picture's bytes stay for the session and are let go on the next load while the current one is kept. Needs `/tmp/wall-shots/Joun autumn`.
