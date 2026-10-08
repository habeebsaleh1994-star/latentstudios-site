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
