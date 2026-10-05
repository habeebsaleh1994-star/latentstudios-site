const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const evidence =
  process.env.LATENT_EVIDENCE_DIRECTORY ||
  fileURLToPath(
    new URL(
      "../docs/evidence/selection-readability/independent-regression/",
      import.meta.url,
    ),
  );
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  hasTouch: true,
});
const page = await context.newPage();
const errors = [],
  results = [],
  workspace = randomUUID();
page.on("pageerror", (e) => errors.push(e.message));
const note = (s) => {
  console.log("PASS", s);
  results.push(s);
};
try {
  await page.goto(`http://127.0.0.1:5181/?studio=${workspace}&page=quiet`);
  const legacy = await page.evaluate(async (workspace) => {
    const { activeWorkspaceId } = await import("/src/workspace.ts");
    if (activeWorkspaceId !== workspace)
      throw Error("Refuse non-test workspace");
    const db = await (await import("/src/database.ts")).database();
    if (await db.get("documents", "site")) throw Error("Refuse existing draft");
    const { initialSite, blankBlock } = await import("/src/model.ts");
    const s = structuredClone(initialSite);
    s.version = 8;
    s.name = "Mira Vale";
    s.styleId = "gallery";
    const p = s.pages.find((p) => p.id === "quiet");
    p.title = "Three ways of being here";
    p.subtitle = "Colour, writing, and the interval between.";
    p.blocks = ["blue", "note", "red"].map((id, i) => ({
      ...blankBlock(i === 1 ? "text" : "image"),
      id,
      text:
        i === 1
          ? "A colour becomes a place when you stay with it long enough."
          : "",
      assetId: i === 1 ? "" : i === 0 ? "formBlue" : "formRed",
      caption: `${id} · Synthetic study`,
      alt: "Original geometric study",
      fit: "landscape",
      focal: { x: 23, y: 72 },
    }));
    const section = (ids, id) => ({
      id,
      blockIds: ids,
      layout: ids.length > 1 ? "columns" : "stack",
      width: "full",
      align: "center",
      vertical: "start",
      gap: 28,
      space: 72,
      mobile: {
        layout: "stack",
        width: "full",
        gap: 24,
        space: 48,
        reverse: false,
      },
    });
    p.composition = {
      enabled: true,
      sections: [section(["blue", "note"], "pair"), section(["red"], "red")],
      mobileOrder: ["pair", "red"],
    };
    s.pages = [s.pages[0], p];
    await db.put("documents", { value: s, revision: 1 }, "site");
    return s;
  }, workspace);
  await page.reload();
  const frame = () => page.frameLocator('iframe[title$="website preview"]');
  const read = () =>
    page.evaluate(
      async () =>
        (
          await (
            await (await import("/src/database.ts")).database()
          ).get("documents", "site")
        ).value,
    );
  const wait = async () => {
    await page.getByText("Saved on this device", { exact: true }).waitFor();
    await page.waitForTimeout(150);
    return read();
  };
  const active = (s) => s.pages[1];
  const pick = (id) => frame().locator(`[data-work-choice="${id}"]`),
    grip = (id) => frame().locator(`[data-work-drag="${id}"]`);
  const device = async (mobile) => {
    await page
      .getByRole("button", {
        name: mobile ? "Mobile preview" : "Desktop preview",
        exact: true,
      })
      .click();
    await page.waitForTimeout(120);
  };
  const clear = async () => {
    const b = page.getByRole("button", {
      name: "Clear work selection",
      exact: true,
    });
    if (await b.count()) await b.click();
  };
  await frame().locator('[data-composition-block="blue"]').waitFor();
  assert.equal((await read()).version, 8);
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await device(true);
  for (const id of ["blue", "note"]) await pick(id).tap();
  await page
    .getByRole("button", { name: "Separate selected", exact: true })
    .click();
  let independent = await wait();
  assert.equal(independent.version, 13);
  assert.deepEqual(
    active(independent).composition.desktop.map((s) => s.blockIds),
    [["blue", "note"], ["red"]],
  );
  assert.deepEqual(
    active(independent).composition.mobile.map((s) => s.blockIds),
    [["blue"], ["note"], ["red"]],
  );
  assert.deepEqual(
    await page.evaluate(
      async () =>
        (
          await (
            await (await import("/src/database.ts")).database()
          ).get("documents", "pre-independent-viewports")
        ).value,
    ),
    legacy,
  );
  await clear();
  await pick("note").click();
  await grip("note").press("Space");
  await grip("note").press("End");
  await grip("note").press("Enter");
  independent = await wait();
  assert.deepEqual(
    active(independent).composition.mobile.flatMap((s) => s.blockIds),
    ["blue", "red", "note"],
  );
  const desktop = structuredClone(active(independent).composition.desktop),
    phone = structuredClone(active(independent).composition.mobile);
  await device(false);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const text = frame().locator(
    '[data-composition-block="note"] .editable-copy',
  );
  await text.click();
  await text.fill(
    "B remains one shared essay, wherever its neighbours change.",
  );
  await text.press("Escape");
  const written = await wait();
  assert.deepEqual(active(written).composition.desktop, desktop);
  assert.deepEqual(active(written).composition.mobile, phone);
  await device(true);
  await frame()
    .getByText("B remains one shared essay, wherever its neighbours change.", {
      exact: true,
    })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await clear();
  await pick("blue").tap();
  await pick("red").tap();
  const touchGrip = grip("blue");
  await touchGrip.scrollIntoViewIfNeeded();
  const touchBox = await touchGrip.boundingBox(),
    targetBox = await frame()
      .locator(`[data-section-id="${phone[0].id}"]`)
      .boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchBox.x + 20, y: touchBox.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      {
        x: targetBox.x + targetBox.width / 2,
        y: targetBox.y + targetBox.height / 2,
      },
    ],
  });
  await frame()
    .locator(`[data-section-id="${phone[0].id}"][data-drop-into="valid"]`)
    .waitFor();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const grouped = await wait();
  assert.deepEqual(active(grouped).composition.mobile[0].blockIds, [
    "blue",
    "red",
  ]);
  assert.deepEqual(active(grouped).composition.desktop, desktop);
  await page.screenshot({ path: evidence + "phone-independent-group.png" });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await wait(), written);
  note(
    "Actual editor: desktop A+B retained; phone separates A,C,B; editing B updates both; phone A+C grouping crosses desktop boundaries and Undo restores phone only.",
  );
  await clear();
  await pick("blue").tap();
  const phoneSection = active(written).composition.mobile[0].id;
  const widthHandle = frame().locator(
    `[data-section-id="${phoneSection}"] [data-canvas-action="width"]`,
  );
  await widthHandle.scrollIntoViewIfNeeded();
  await widthHandle.focus();
  await page.waitForTimeout(120);
  await widthHandle.press("Home");
  const narrower = await wait();
  assert.equal(active(narrower).composition.mobile[0].widthPercent, 25);
  assert.deepEqual(active(narrower).composition.desktop, desktop);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await wait(), written);
  // Interrupted real pointer and keyboard gestures may never become persisted moves.
  const handle = grip("blue");
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 25, box.y + 90, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(await wait(), written);
  await handle.press("Space");
  await handle.press("End");
  await page.reload();
  assert.deepEqual(await wait(), written);
  note(
    "Phone-only width, pointer cancellation and reload during a lifted keyboard move preserve shared content and desktop geometry.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.locator("#study-name").fill("Desktop pair, phone A C B");
  await page.getByRole("button", { name: "Keep study", exact: true }).click();
  const kept = await wait();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await device(true);
  await pick("blue").click();
  await pick("red").click();
  await page
    .getByRole("button", { name: "Group selected", exact: true })
    .click();
  await wait();
  await page
    .getByRole("button", { name: "Try group arrangements ↗", exact: true })
    .click();
  await page.getByRole("button", { name: /A quieter column/ }).click();
  await page
    .getByRole("button", { name: "Use A quieter column", exact: true })
    .click();
  const alternative = await wait();
  assert.equal(active(alternative).composition.mobile[0].width, "inset");
  assert.deepEqual(active(alternative).composition.desktop, desktop);
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page
    .getByRole("button", { name: /^Desktop pair, phone A C B/ })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(),
    true,
  );
  assert.deepEqual(await read(), alternative);
  await page.screenshot({
    path: evidence + "independent-study-comparison.png",
  });
  await page
    .getByRole("button", { name: "Use this arrangement", exact: true })
    .click();
  const applied = await wait();
  assert.deepEqual(active(applied).composition, active(kept).composition);
  assert.deepEqual(active(applied).blocks, active(written).blocks);
  await page.reload();
  assert.deepEqual(await wait(), applied);
  note(
    "A saved study retains both independent layouts; phone alternatives leave desktop intact; read-only A/B and explicit Apply keep current words, displaced study and reload persistence.",
  );
  // Actual exporter, including frozen synthetic media. ZIP is unzipped and rendered with its own media files.
  const exports = await page.evaluate(async () => {
    const record = await (
      await (await import("/src/database.ts")).database()
    ).get("documents", "site");
    const { collectMedia } = await import("/src/revisions.ts");
    const { portableHTML, portablePackage } = await import("/src/portable.ts");
    const r = {
      format: "latent-studio-revision",
      version: 1,
      id: "independent-browser-proof",
      name: "Synthetic proof",
      createdAt: new Date().toISOString(),
      sourceRevision: record.revision,
      site: record.value,
      ...(await collectMedia(record.value)),
    };
    const zip = await portablePackage(r, "original");
    return {
      html: await portableHTML(r),
      zip: Array.from(new Uint8Array(await zip.blob.arrayBuffer())),
    };
  });
  await writeFile(evidence + "independent-artist.html", exports.html);
  await writeFile(
    evidence + "independent-artist.zip",
    Buffer.from(exports.zip),
  );
  await mkdir(evidence + "zip", { recursive: true });
  execFileSync("/usr/bin/unzip", [
    "-o",
    evidence + "independent-artist.zip",
    "-d",
    evidence + "zip",
  ]);
  const exported = await context.newPage();
  exported.on("pageerror", (e) => errors.push(e.message));
  await exported.route("**/__independent-export/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/__independent-export/",
    )[1];
    const body =
      path === "standalone.html"
        ? exports.html
        : await readFile(evidence + "zip/" + path);
    await route.fulfill({
      status: 200,
      contentType: path.endsWith(".html")
        ? "text/html"
        : path.endsWith(".svg")
          ? "image/svg+xml"
          : undefined,
      body,
    });
  });
  for (const delivery of ["standalone.html", "index.html"])
    for (const width of [390, 1440]) {
      await exported.setViewportSize({ width, height: 1000 });
      await exported.goto(
        `http://127.0.0.1:5181/__independent-export/${delivery}?page=quiet`,
      );
      await exported.locator('[data-arranged-page="quiet"]').waitFor();
      const layout =
        active(applied).composition[width === 390 ? "mobile" : "desktop"];
      assert.deepEqual(
        await exported
          .locator("[data-composition-block]")
          .evaluateAll((els) => els.map((el) => el.dataset.compositionBlock)),
        layout.flatMap((s) => s.blockIds),
      );
      assert.deepEqual(
        await exported.locator("[data-section-id]").evaluateAll((els) =>
          els.map((el) => ({
            id: el.dataset.sectionId,
            gap: el.style.getPropertyValue("--section-gap"),
            space: el.style.getPropertyValue("--section-space"),
            width: el.style.getPropertyValue("--section-width"),
          })),
        ),
        layout.map((s) => ({
          id: s.id,
          gap: `${s.gap}px`,
          space: `${s.space}px`,
          width: { full: "100%", inset: "88%", wide: "84%", reading: "64%" }[
            s.width
          ],
        })),
      );
      assert.equal(
        await exported
          .locator('[data-composition-block="blue"] img')
          .evaluate((el) => el.style.objectPosition),
        "23% 72%",
      );
      await exported
        .getByText(
          "B remains one shared essay, wherever its neighbours change.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await exported
          .locator("[data-canvas-action],[data-work-choice]")
          .count(),
        0,
      );
      await exported.locator("img").evaluateAll(async (els) => {
        for (const el of els) el.loading = "eager";
        await Promise.all(els.map((el) => el.decode()));
      });
      assert.ok(
        await exported
          .locator("img")
          .evaluateAll((els) =>
            els.every((el) => el.complete && el.naturalWidth > 0),
          ),
      );
      await exported.screenshot({
        path: evidence + `${delivery}-${width}.png`,
        fullPage: true,
      });
    }
  note(
    "Standalone HTML and extracted ZIP both render exact desktop/phone membership, order, geometry, shared essay, media and focal point at 390 and 1440; no editor controls or private studies.",
  );
  await exported.close();
  assert.deepEqual(errors, []);
  await writeFile(
    evidence + "browser-results.json",
    JSON.stringify(
      { browser: browser.version(), workspace, results, errors },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: evidence + "failure.png" });
  throw error;
} finally {
  await browser.close();
}
