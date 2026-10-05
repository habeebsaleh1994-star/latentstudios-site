const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence =
  process.env.LATENT_EVIDENCE_DIRECTORY ||
  fileURLToPath(
    new URL("../docs/evidence/selection-readability/", import.meta.url),
  );
const backup = JSON.parse(
  await readFile(
    new URL(
      "../docs/evidence/spatial-sections/editable-backup.json",
      import.meta.url,
    ),
    "utf8",
  ),
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
    section = () => frame().locator('[data-section-id="plate"]');
  const read = () =>
    page.evaluate(
      async () =>
        (
          await (
            await (await import("/src/database.ts")).database()
          ).get("documents", "site")
        ).value,
    );
  const saved = async () => {
    await page.getByText("Saved on this device", { exact: true }).waitFor();
    await page.waitForTimeout(150);
    return read();
  };
  const pick = async (id) => {
    await page.locator(".work-picker-toggle").click();
    await page.locator(`[data-work-picker="${id}"]`).click();
    await page.waitForTimeout(140);
  };
  const tab = async (name) => {
    const t = page.getByRole("button", { name, exact: true });
    if ((await t.getAttribute("aria-expanded")) !== "true") await t.click();
  };
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  await page
    .getByLabel("Actual viewport width", { exact: true })
    .selectOption("768");
  await page.waitForTimeout(250);
  await pick("verse");
  const before = await saved(),
    move = page.getByRole("button", {
      name: "Move selected work",
      exact: true,
    }),
    resize = page.getByRole("button", {
      name: "Resize selected work width",
      exact: true,
    });
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
  await tab("Position");
  await page
    .getByLabel("Snap to nearby edges and equal gaps", { exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Position", exact: true }).click();
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
    "Dock pointer movement displays a real equal-gap guide and commits once; snapping can be disabled without losing precise geometry.",
  );
  const red = section().locator('[data-composition-block="red"]');
  await red.scrollIntoViewIfNeeded();
  const scroll = () =>
    red.evaluate((el) => el.ownerDocument.defaultView.scrollY);
  const y = await scroll(),
    stable = await saved();
  await red.click({ position: { x: 15, y: 15 } });
  await page.waitForTimeout(180);
  assert.equal(
    await page.locator(".work-context").getAttribute("data-work-id"),
    "red",
  );
  assert.equal(await scroll(), y);
  assert.deepEqual(await saved(), stable);
  await resize.focus();
  for (let i = 0; i < 12; i++) await resize.press("Shift+ArrowRight");
  next = await saved();
  const f = next.pages[1].composition.desktop[0].spatial.frames.find(
    (f) => f.blockId === "red",
  );
  assert.equal(f.x, 85);
  assert.equal(f.width, 15);
  assert.deepEqual(next.pages[1].blocks, stable.pages[1].blocks);
  const bound = next;
  await page.getByRole("button", { name: "Find", exact: true }).click();
  const direct = section().getByRole("button", {
    name: "Resize this work",
    exact: true,
  });
  await direct.scrollIntoViewIfNeeded();
  const directBox = await direct.boundingBox();
  assert.ok(directBox.width >= 43.5 && directBox.height >= 43.5);
  await direct.press("Shift+ArrowLeft");
  assert.notDeepEqual(await saved(), bound);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), bound);
  r = await red.boundingBox();
  await page.mouse.move(r.x + 15, r.y + 15);
  await page.mouse.down();
  await page.mouse.move(r.x - 5, r.y + 35, { steps: 4 });
  assert.deepEqual(await read(), bound);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(await saved(), bound);
  r = await red.boundingBox();
  await page.mouse.move(r.x + 15, r.y + 15);
  await page.mouse.down();
  await page.mouse.move(r.x - 5, r.y + 35, { steps: 4 });
  await page.mouse.up();
  assert.notDeepEqual(await saved(), bound);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), bound);
  await move.focus();
  await page.keyboard.down("ArrowDown");
  await page.getByLabel("Actual viewport width", { exact: true }).focus();
  await page.keyboard.up("ArrowDown");
  assert.deepEqual(await saved(), bound);
  const cdp = await context.newCDPSession(page);
  r = await resize.boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: r.x + 20, y: r.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: r.x + 5, y: r.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.deepEqual(await saved(), bound);
  results.push(
    "Canvas click identifies the same work without scrolling it away. Direct resize has a 44px target. Artwork drag, right-edge clamping, keyboard focus loss, Escape and touch cancellation preserve exact source/layer state and one-step Undo.",
  );
  // Layers and authored reading order stay independently reachable in the same surface.
  await pick("film");
  await tab("Layers");
  const ordering = await saved();
  await page
    .getByRole("button", { name: "Bring forward", exact: true })
    .click();
  const layered = await saved();
  assert.deepEqual(
    layered.pages[1].composition.desktop[0].blockIds,
    ordering.pages[1].composition.desktop[0].blockIds,
  );
  assert.notDeepEqual(
    layered.pages[1].composition.desktop[0].spatial.layers,
    ordering.pages[1].composition.desktop[0].spatial.layers,
  );
  await tab("Reading");
  await page.getByRole("button", { name: "Read earlier", exact: true }).click();
  const reordered = await saved();
  assert.deepEqual(
    reordered.pages[1].composition.desktop[0].spatial.layers,
    layered.pages[1].composition.desktop[0].spatial.layers,
  );
  assert.notDeepEqual(
    reordered.pages[1].composition.desktop[0].blockIds,
    layered.pages[1].composition.desktop[0].blockIds,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), ordering);
  await tab("Section");
  await page
    .getByRole("button", { name: "Adjust section minimum height", exact: true })
    .press("Shift+ArrowDown");
  assert.notDeepEqual(await saved(), ordering);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), ordering);
  await pick("red");
  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  assert.deepEqual(await read(), ordering);
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await page.waitForTimeout(200);
  assert.equal(
    await page.getByRole("button", { name: "End reveal", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.locator(".work-context").getAttribute("data-work-id"),
    "red",
  );
  assert.deepEqual(await saved(), ordering);
  await page
    .getByRole("button", { name: "Desktop preview", exact: true })
    .click();
  await page.waitForTimeout(200);
  r = await resize.boundingBox();
  await page.mouse.move(r.x + 20, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x + 10, r.y + 20);
  await page.reload();
  await page.mouse.up();
  assert.deepEqual(await saved(), ordering);
  results.push(
    "Layer and reading controls remain independent and undoable; device switching cancels temporary reveal while retaining work identity, and reload during a dock resize discards unfinished geometry.",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    evidence + "gesture-browser-results.json",
    JSON.stringify(
      { browser: browser.version(), workspace, results, directBox, errors },
      null,
      2,
    ),
  );
  results.forEach((r) => console.log("PASS", r));
} catch (e) {
  await writeFile(
    evidence + "gesture-failure.json",
    JSON.stringify({ errors, message: String(e) }, null, 2),
  );
  await page.screenshot({ path: evidence + "gesture-failure.png" });
  throw e;
} finally {
  await browser.close();
}
