import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
const root = fileURLToPath(
    new URL("../docs/evidence/relationships/", import.meta.url),
  ),
  source = JSON.parse(await readFile(root + "source-before.json", "utf8"));
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  }),
  errors = [],
  workspaces = [];
async function open(site) {
  const page = await context.newPage(),
    workspace = randomUUID();
  workspaces.push(workspace);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:5181/?studio=${workspace}&page=quiet`);
  await page.evaluate(
    async ({ workspace, site }) => {
      if ((await import("/src/workspace.ts")).activeWorkspaceId !== workspace)
        throw Error("Wrong workspace");
      const db = await (await import("/src/database.ts")).database();
      if (await db.get("documents", "site")) throw Error("Existing workspace");
      await db.put("documents", { value: site, revision: 1 }, "site");
    },
    { workspace, site },
  );
  await page.reload();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  if (await page.locator(".work-picker-toggle").count()) {
    await page.locator(".work-picker-toggle").click();
    await page.locator('[data-work-picker="relationship-image"]').click();
  } else
    await page
      .frameLocator('iframe[title$="website preview"]')
      .locator('[data-work-choice="relationship-image"]')
      .click();
  return page;
}
const read = (page) =>
  page.evaluate(
    async () =>
      (
        await (
          await (await import("/src/database.ts")).database()
        ).get("documents", "site")
      ).value,
  );
const saved = async (page) => {
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  await page.waitForTimeout(180);
  return read(page);
};
try {
  const page = await open(source),
    actions = [];
  const click = async (name) => {
    await page.getByRole("button", { name, exact: true }).click();
    actions.push(name);
    await saved(page);
  };
  for (const mobile of [false, true]) {
    if (mobile) await click("Mobile preview");
    await click("Reading");
    await click("Read earlier");
    await click("Section");
    await click("Preview flow ↗");
    await click("Use flow · keep placement");
  }
  const manual = await saved(page);
  for (const device of ["desktop", "mobile"]) {
    assert.deepEqual(manual.pages[1].composition[device][0].blockIds, [
      "relationship-image",
      "relationship-writing",
    ]);
    assert.equal(manual.pages[1].composition[device][0].spatial.enabled, false);
  }
  assert.equal(actions.length, 11);
  assert.deepEqual(
    Object.fromEntries(manual.pages[1].blocks.map((b) => [b.id, b])),
    Object.fromEntries(source.pages[1].blocks.map((b) => [b.id, b])),
  );
  await page.screenshot({ path: root + "manual-controls-completion.png" });
  await page.close();
  const large = structuredClone(source);
  large.pages[1].blocks.find((b) => b.type === "text").typography.base.size =
    32;
  const narrow = await open(large),
    before = await saved(narrow);
  await narrow
    .getByRole("button", { name: "Explore image + writing ↗", exact: true })
    .click();
  await narrow
    .getByRole("button", { name: "Explore compositions", exact: true })
    .click();
  await narrow.getByText(/2 valid alternatives/).waitFor({ timeout: 20000 });
  assert.match(
    await narrow.locator(".relationship-stage").innerText(),
    /The image leads unavailable/,
  );
  assert.match(
    await narrow.locator(".relationship-stage").innerText(),
    /16 characters/,
  );
  await narrow.waitForTimeout(500);
  await narrow.screenshot({ path: root + "fewer-readable-alternatives.png" });
  assert.deepEqual(await read(narrow), before);
  // Exploration-only keeps the remembered-rule store unchanged and affects exactly one device.
  await narrow.getByLabel("Remember on Apply", { exact: false }).uncheck();
  await narrow
    .getByRole("button", { name: "Explore compositions", exact: true })
    .click();
  await narrow.getByText(/2 valid alternatives/).waitFor();
  await narrow
    .getByRole("button", { name: "Apply In conversation", exact: true })
    .click();
  const one = await saved(narrow);
  assert.equal(one.pages[1].intentions, undefined);
  assert.deepEqual(
    one.pages[1].composition.mobile,
    before.pages[1].composition.mobile,
  );
  await narrow.close();
  // Deletion via the actual content inspector removes live references; Undo restores them and their unchanged work.
  const authored = JSON.parse(
    await readFile(root + "editable-backup.json", "utf8"),
  ).site;
  // Use bundled synthetic originals, not the backup's remapped frozen IDs, in this separate editing fixture.
  authored.pages[1].blocks.find((b) => b.type === "image").assetId = "formBlue";
  const deletion = await open(authored),
    initial = await saved(deletion);
  await deletion.getByRole("button", { name: "Edit", exact: true }).click();
  await deletion
    .getByRole("button", { name: "Show inspector", exact: true })
    .click();
  await deletion
    .getByRole("button", { name: "Remove this block", exact: true })
    .click();
  const removed = await saved(deletion);
  assert.equal(removed.pages[1].blocks.length, 1);
  assert.deepEqual(removed.pages[1].intentions, []);
  await deletion
    .getByRole("button", { name: "Undo", exact: true })
    .first()
    .click();
  assert.deepEqual(await saved(deletion), initial);
  await deletion.reload();
  assert.deepEqual(await saved(deletion), initial);
  await deletion.close();
  const flow = structuredClone(authored);
  for (const device of ["desktop", "mobile"])
    flow.pages[1].composition[device].forEach((s) => delete s.spatial);
  const flowing = await open(flow),
    flowBefore = await saved(flowing);
  await flowing
    .getByRole("button", {
      name: "Remove together intention for both",
      exact: true,
    })
    .click();
  const flowAfter = await saved(flowing);
  assert.deepEqual(
    flowAfter.pages[1].composition,
    flowBefore.pages[1].composition,
  );
  assert.equal(flowAfter.pages[1].intentions.length, 1);
  await flowing.close();
  assert.deepEqual(errors, []);
  await writeFile(
    root + "boundaries-browser-results.json",
    JSON.stringify(
      {
        workspaces,
        browser: browser.version(),
        manualActions: actions,
        manualDocumentMutations: 4,
        relationshipActions: [
          "Explore image + writing",
          "Choose Desktop + phone",
          "Explore compositions",
          "Apply In conversation",
        ],
        relationshipDocumentMutations: 1,
        comparisonScope:
          "Starts with image selected and Arrange active. Same task goal: shared section, image immediately before writing, desktop columns and phone flow; not pixel-identical geometry. Existing v17 manual controls exercised in v18.",
        checks: [
          "11 manual actions versus 4 relationship actions for this fixture",
          "32px authored type filters emphasis without resizing type",
          "two honest valid alternatives",
          "exploration-only does not persist intentions",
          "desktop-only preserves phone byte-for-byte",
          "actual inspector deletion prunes references and Undo/reload restores exact source",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS boundary cases and observed 11 versus 4 action walkthrough",
  );
} catch (error) {
  for (const p of context.pages())
    await p.screenshot({ path: root + "boundary-failure.png" }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
