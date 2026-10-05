const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence = fileURLToPath(
  new URL(
    "../docs/evidence/selection-readability/type-controls-regression/",
    import.meta.url,
  ),
);
await mkdir(evidence, { recursive: true });
const backup = JSON.parse(
  await readFile(evidence + "../type-regression/editable-backup.json", "utf8"),
);
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  }),
  page = await context.newPage(),
  workspace = randomUUID(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:5181/?studio=${workspace}&page=quiet`);
  await page.evaluate(
    async ({ workspace, site }) => {
      if ((await import("/src/workspace.ts")).activeWorkspaceId !== workspace)
        throw Error("Refuse non-test workspace");
      const db = await (await import("/src/database.ts")).database();
      if (await db.get("documents", "site"))
        throw Error("Refuse existing draft");
      const valid = (await import("/src/model.ts")).siteSchema.parse(site);
      await db.put("documents", { value: valid, revision: 1 }, "site");
    },
    { workspace, site: backup.site },
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .frameLocator('iframe[title$="website preview"]')
    .locator('[data-text-work="poem"]')
    .click();
  await page
    .getByRole("button", { name: "Style this writing", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Style this writing",
    exact: true,
  });
  const size = dialog.getByRole("spinbutton", {
    name: "Text size",
    exact: true,
  });
  await size.fill("");
  await size.pressSequentially("23");
  assert.equal(await size.inputValue(), "23");
  const leading = dialog.getByRole("spinbutton", {
    name: "Line height",
    exact: true,
  });
  await leading.fill("");
  await leading.pressSequentially("1.85");
  await leading.press("Tab");
  assert.equal(await leading.inputValue(), "1.85");
  await dialog
    .getByRole("button", { name: "Named style · 2", exact: true })
    .click();
  await dialog.getByText("Name & role", { exact: true }).click();
  await dialog
    .getByLabel("Rename text style", { exact: true })
    .fill("Shared verse");
  await dialog.getByLabel("Rename text style", { exact: true }).press("Tab");
  await dialog
    .getByLabel("Text style role", { exact: true })
    .selectOption("custom");
  await dialog
    .getByLabel("Typography device scope", { exact: true })
    .selectOption("base");
  await page.getByText("Saved on this device", { exact: true }).waitFor();
  const saved = await page.evaluate(
    async () =>
      (
        await (
          await (await import("/src/database.ts")).database()
        ).get("documents", "site")
      ).value,
  );
  const poem = saved.pages[1].blocks.find((b) => b.id === "poem");
  assert.equal(poem.typography.mobile.size, 23);
  assert.equal(poem.typography.mobile.leading, 1.85);
  assert.deepEqual(saved.textStyles[0].base, backup.site.textStyles[0].base);
  assert.equal(saved.textStyles[0].name, "Shared verse");
  assert.equal(saved.textStyles[0].role, "custom");
  assert.deepEqual(
    saved.pages.map((p) => p.blocks.map((b) => b.text)),
    backup.site.pages.map((p) => p.blocks.map((b) => b.text)),
  );
  await dialog.getByText("Name & role", { exact: true }).click();
  await dialog.getByRole("button", { name: "This work", exact: true }).click();
  await dialog
    .getByLabel("Typography device scope", { exact: true })
    .selectOption("mobile");
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await dialog.evaluate((el) =>
        el.contains(el.ownerDocument.activeElement),
      ),
      "Tab stays inside writing controls",
    );
  }
  const measurements = await dialog.evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    closeHeight: el
      .querySelector('[aria-label="Close writing style"]')
      .getBoundingClientRect().height,
    historyHeights: [...el.querySelectorAll(".type-dialog-history button")].map(
      (b) => b.getBoundingClientRect().height,
    ),
  }));
  assert.ok(measurements.scrollWidth <= measurements.clientWidth + 1);
  assert.ok(
    measurements.closeHeight >= 44 &&
      measurements.historyHeights.every((h) => h >= 44),
  );
  await dialog.evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: evidence + "phone-type-controls-390.png" });
  await page.keyboard.press("Escape");
  assert.equal(await dialog.count(), 0);
  assert.ok(
    await page
      .getByRole("button", { name: "Exit canvas focus", exact: true })
      .isVisible(),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    evidence + "type-controls-browser-results.json",
    JSON.stringify(
      {
        browser: browser.version(),
        workspace,
        measurements,
        results: [
          "390px writing controls: multi-digit and decimal keyboard entry, style rename/role preserves subscribers and declarations, explicit device scope, Tab containment, Escape keeps focused canvas, no horizontal overflow and 44px close/history targets.",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS Phone writing controls, typed numbers, rename/role, focus containment and Escape.",
  );
} finally {
  await browser.close();
}
