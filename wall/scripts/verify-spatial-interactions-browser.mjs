const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence = fileURLToPath(
    new URL("../docs/evidence/spatial-sections/", import.meta.url),
  ),
  backup = JSON.parse(
    await readFile(evidence + "editable-backup.json", "utf8"),
  );
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    hasTouch: true,
  }),
  page = await context.newPage(),
  workspace = randomUUID(),
  errors = [],
  results = [];
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
      const s = structuredClone(site),
        sp = s.pages[1].composition.desktop[0].spatial;
      sp.frames = [
        { blockId: "blue", x: 0, y: 0, width: 10 },
        { blockId: "verse", x: 37.1, y: 0, width: 20 },
        { blockId: "red", x: 85, y: 0, width: 10 },
        { blockId: "film", x: 0, y: 800, width: 10 },
      ];
      sp.minHeight = 0;
      await db.put(
        "documents",
        {
          value: (await import("/src/model.ts")).siteSchema.parse(s),
          revision: 1,
        },
        "site",
      );
    },
    { workspace, site: backup.site },
  );
  await page.reload();
  const frame = () => page.frameLocator('iframe[title$="website preview"]'),
    section = () => frame().locator('[data-section-id="plate"]'),
    read = () =>
      page.evaluate(
        async () =>
          (
            await (
              await (await import("/src/database.ts")).database()
            ).get("documents", "site")
          ).value,
      ),
    saved = async () => {
      await page.getByText("Saved on this device", { exact: true }).waitFor();
      await page.waitForTimeout(150);
      return read();
    };
  await section().waitFor();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  await section()
    .getByLabel("Work to place", { exact: true })
    .selectOption("verse");
  const before = await saved(),
    move = section().getByRole("button", {
      name: "Move selected work",
      exact: true,
    });
  await move.scrollIntoViewIfNeeded();
  let r = await move.boundingBox();
  await page.mouse.move(r.x + 20, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x + 22, r.y + 20);
  await section().getByText("Equal gaps", { exact: true }).waitFor();
  assert.deepEqual(await read(), before);
  await page.mouse.up();
  let next = await saved();
  assert.equal(
    next.pages[1].composition.desktop[0].spatial.frames.find(
      (f) => f.blockId === "verse",
    ).x,
    37.5,
  );
  await section().locator(".spatial-options summary").click();
  await section()
    .getByLabel("Snap to nearby edges and equal gaps", { exact: true })
    .uncheck();
  await section().locator(".spatial-options summary").click();
  r = await move.boundingBox();
  await page.mouse.move(r.x + 20, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x + 18, r.y + 20);
  assert.equal(await section().locator(".spatial-guide").count(), 0);
  await page.mouse.up();
  next = await saved();
  assert.notEqual(
    next.pages[1].composition.desktop[0].spatial.frames.find(
      (f) => f.blockId === "verse",
    ).x,
    37.5,
  );
  results.push(
    "A real drag displays the equal-gap guide and snaps precisely; disabling snaps permits an unsnapped position, without intermediate saves.",
  );
  // Width reaches the right edge without moving its left edge or editing crops.
  await section()
    .getByLabel("Work to place", { exact: true })
    .selectOption("red");
  const resize = section().getByRole("button", {
    name: "Resize selected work width",
    exact: true,
  });
  await resize.focus();
  await page.waitForTimeout(100);
  for (let i = 0; i < 12; i++) await resize.press("Shift+ArrowRight");
  next = await saved();
  let red = next.pages[1].composition.desktop[0].spatial.frames.find(
    (f) => f.blockId === "red",
  );
  assert.equal(red.x, 85);
  assert.equal(red.width, 15);
  assert.deepEqual(next.pages[1].blocks, before.pages[1].blocks);
  // Keyboard cancellation, loss of focus and reload discard live geometry.
  const stable = await saved();
  await move.focus();
  await page.keyboard.down("ArrowDown");
  await page.getByRole("button", { name: "Guides", exact: true }).focus();
  await page.keyboard.up("ArrowDown");
  assert.deepEqual(await saved(), stable);
  await move.focus();
  await page.keyboard.down("ArrowDown");
  await page.keyboard.press("Escape");
  await page.keyboard.up("ArrowDown");
  assert.deepEqual(await saved(), stable);
  await resize.scrollIntoViewIfNeeded();
  r = await resize.boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: r.x + 20, y: r.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: r.x - 20, y: r.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.deepEqual(await saved(), stable);
  await resize.scrollIntoViewIfNeeded();
  r = await resize.boundingBox();
  await page.mouse.move(r.x + 20, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x - 20, r.y + 20);
  await page.reload();
  await page.mouse.up();
  assert.deepEqual(await saved(), stable);
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  results.push(
    "Right-edge resize retains x, assets and crops. Real preview blur, Escape during a held key, emulated touch cancellation and reload during a live resize preserve the exact stored draft.",
  );
  const controls = [];
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    // Let the editor's responsive shell reparent its iframe before targeting
    // controls in the newly mounted document.
    await page.waitForTimeout(300);
    await section()
      .locator(".spatial-options summary")
      .scrollIntoViewIfNeeded();
    await section().locator(".spatial-options summary").click();
    const pop = section().locator(".spatial-options > div");
    const box = await pop.boundingBox(),
      field = await section()
        .getByLabel("Across (%)", { exact: true })
        .boundingBox(),
      text = await section()
        .getByLabel("Across (%)", { exact: true })
        .evaluate((el) => parseFloat(globalThis.getComputedStyle(el).fontSize)),
      logicalWidth = await pop.evaluate(
        (el) => el.getBoundingClientRect().width,
      );
    const physicalFont = (text * box.width) / logicalWidth;
    assert.ok(field.height >= 43.5);
    assert.ok(physicalFont >= 15.5);
    const rail = await section().locator(".spatial-tools").boundingBox();
    assert.ok(box.width >= Math.min(360, rail.width) - 1);
    assert.ok(await pop.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: evidence + `precision-${width}.png` });
    controls.push({ width, box, field, physicalFont });
    await section().locator(".spatial-options summary").click();
  }
  // A phone has its own spatial section and contextual controls at actual phone scale.
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  const phone = frame().locator('[data-section-id="phone-blue"]');
  await phone
    .getByRole("button", { name: "Resume placement", exact: true })
    .click();
  await saved();
  await phone.locator(".spatial-options summary").click();
  await page.screenshot({ path: evidence + "phone-placement-controls.png" });
  assert.ok(
    (await phone.getByLabel("Width (%)", { exact: true }).boundingBox())
      .height >= 44,
  );
  assert.deepEqual(errors, []);
  results.push(
    "Precision controls remain readable and touch-sized in Fit at 390/768/1440, with actual phone placement available independently.",
  );
  await writeFile(
    evidence + "interaction-browser-results.json",
    JSON.stringify(
      { browser: browser.version(), workspace, results, controls, errors },
      null,
      2,
    ),
  );
  console.log(results.map((s) => "PASS " + s).join("\n"));
} catch (e) {
  await page.screenshot({ path: evidence + "interaction-failure.png" });
  throw e;
} finally {
  await browser.close();
}
