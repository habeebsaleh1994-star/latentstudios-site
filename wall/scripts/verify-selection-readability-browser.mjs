const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence = fileURLToPath(
  new URL("../docs/evidence/selection-readability/", import.meta.url),
);
await mkdir(evidence, { recursive: true });
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
    reducedMotion: "reduce",
  }),
  page = await context.newPage(),
  workspace = randomUUID(),
  errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("BROWSER ERROR", e.message);
});
try {
  await page.goto(`http://127.0.0.1:5181/?studio=${workspace}&page=quiet`);
  await page.evaluate(
    async ({ workspace, site }) => {
      if ((await import("/src/workspace.ts")).activeWorkspaceId !== workspace)
        throw Error("Refuse non-test workspace");
      const db = await (await import("/src/database.ts")).database();
      if (await db.get("documents", "site"))
        throw Error("Refuse existing draft");
      await db.put("documents", { value: site, revision: 1 }, "site");
    },
    { workspace, site: backup.site },
  );
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
  const saved = async () => {
    await page.getByText("Saved on this device", { exact: true }).waitFor();
    await page.waitForTimeout(180);
    return read();
  };
  await frame().locator(".spatial-stage").waitFor();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  await page
    .getByLabel("Actual viewport width", { exact: true })
    .selectOption("768");
  await page.waitForTimeout(500);
  assert.equal(
    await page
      .locator('iframe[title$="website preview"]')
      .evaluate((el) => el.contentWindow.innerWidth),
    768,
  );
  let recordedPicker = false;
  const pick = async (id) => {
    await page.locator(".work-picker-toggle").click();
    if (!recordedPicker) {
      await page
        .locator(".work-picker img")
        .evaluateAll(async (imgs) =>
          Promise.all(imgs.map((img) => img.decode())),
        );
      await page.screenshot({ path: evidence + "visual-picker.png" });
      recordedPicker = true;
    }
    await page.locator(`[data-work-picker="${id}"]`).click();
    await page.waitForTimeout(200);
  };
  await pick("verse");
  await page.getByRole("button", { name: /^Readability/ }).click();
  await page
    .getByText("Writing may be covered by a higher layer at this width.", {
      exact: true,
    })
    .waitFor();
  const before = await saved();
  await page.screenshot({ path: evidence + "tablet-occlusion.png" });
  await page.getByRole("button", { name: "Reveal", exact: true }).click();
  assert.equal(
    await frame()
      .locator('[data-composition-block="verse"]')
      .getAttribute("data-preview-reveal"),
    "true",
  );
  assert.deepEqual(await read(), before);
  await page.screenshot({ path: evidence + "temporary-reveal.png" });
  await page.keyboard.press("Escape");
  assert.equal(await frame().locator("[data-preview-reveal]").count(), 0);
  assert.deepEqual(await read(), before);
  await pick("red");
  await page.getByRole("button", { name: "Caption", exact: true }).click();
  await page
    .getByLabel("Caption backing", { exact: true })
    .selectOption("paper");
  await page.getByLabel("Caption size", { exact: true }).selectOption("16");
  await page
    .getByLabel("Caption position", { exact: true })
    .selectOption("above");
  const treated = await saved();
  assert.deepEqual(treated.pages[1].blocks, before.pages[1].blocks);
  assert.deepEqual(
    treated.pages[1].composition.mobile,
    before.pages[1].composition.mobile,
  );
  await page.screenshot({ path: evidence + "caption-treatment.png" });
  // Explicit author choice resolves the tablet collision while retaining image overlap.
  await page.getByRole("button", { name: "Position", exact: true }).click();
  await page.getByLabel("Across (%)", { exact: true }).fill("30");
  await page.getByLabel("Across (%)", { exact: true }).press("Enter");
  const readable = await saved();
  assert.deepEqual(
    readable.pages[1].composition.desktop[0].spatial.layers,
    before.pages[1].composition.desktop[0].spatial.layers,
  );
  await pick("verse");
  await page.getByRole("button", { name: /^Readability/ }).click();
  assert.equal(
    await page
      .getByText("Writing may be covered by a higher layer at this width.", {
        exact: true,
      })
      .count(),
    0,
  );
  await page.screenshot({ path: evidence + "tablet-authored-adjustment.png" });
  await pick("red");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: "Show inspector", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Caption", { exact: true }).inputValue(),
    readable.pages[1].blocks.find((b) => b.id === "red").caption,
  );
  assert.equal(await page.locator(".editor-sidebar").isVisible(), true);
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  assert.equal(
    await page.locator(".work-context").getAttribute("data-work-id"),
    "red",
  );
  assert.equal(await page.locator(".editor-sidebar").isVisible(), false);
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await page.waitForTimeout(400);
  assert.equal(
    await page.locator(".work-context").getAttribute("data-work-id"),
    "red",
  );
  await page.screenshot({ path: evidence + "phone-context.png" });
  const notes = [
    "Actual 768px viewport reproduces the existing occlusion; geometric feedback is nonblocking. Visual selection and temporary reveal preserve all saved layers and source content.",
    "Explicit backing, 16px caption size, caption position and an authored image move improve readability without automatic layout changes. The same selected work remains identified on phone.",
  ];
  // Phone placement, progressive precision and cancellation.
  await pick("blue");
  await frame()
    .locator('[data-section-id="phone-blue"]')
    .getByRole("button", { name: "Resume placement", exact: true })
    .click();
  await page.getByRole("button", { name: "Position", exact: true }).click();
  const phoneBefore = await saved();
  const across = page.getByLabel("Across (%)", { exact: true });
  await across.fill("17.2367");
  await across.press("Enter");
  let placed = await saved();
  assert.equal(
    placed.pages[1].composition.mobile[0].spatial.frames[0].x,
    17.2367,
  );
  assert.equal(await across.inputValue(), "17.24");
  await across.focus();
  await across.press("Tab");
  assert.deepEqual(await saved(), placed);
  await across.fill("18.9876");
  await across.press("Escape");
  assert.deepEqual(await saved(), placed);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), phoneBefore);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.deepEqual(await saved(), placed);
  assert.deepEqual(
    placed.pages[1].composition.desktop,
    phoneBefore.pages[1].composition.desktop,
  );
  const move = page.getByRole("button", {
    name: "Move selected work",
    exact: true,
  });
  await move.press("Shift+ArrowDown");
  const keyed = await saved();
  assert.equal(
    keyed.pages[1].composition.mobile[0].spatial.frames[0].y,
    placed.pages[1].composition.mobile[0].spatial.frames[0].y + 10,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), placed);
  await page.getByRole("button", { name: "Position", exact: true }).click();
  await page.getByRole("button", { name: "Find", exact: true }).click();
  const resize = page.getByRole("button", {
    name: "Resize selected work width",
    exact: true,
  });
  const r = await resize.boundingBox(),
    cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: r.x + 20, y: r.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: r.x + 5, y: r.y + 20 }],
  });
  assert.deepEqual(await read(), placed);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.notDeepEqual(await saved(), placed);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), placed);
  await move.focus();
  await page.keyboard.down("ArrowDown");
  await page.keyboard.press("Escape");
  await page.keyboard.up("ArrowDown");
  assert.deepEqual(await saved(), placed);
  await page.getByRole("button", { name: "Caption", exact: true }).click();
  await page.getByLabel("Caption size", { exact: true }).selectOption("14");
  await page
    .getByLabel("Caption backing", { exact: true })
    .selectOption("paper");
  placed = await saved();
  assert.deepEqual(
    placed.pages[1].composition.desktop,
    phoneBefore.pages[1].composition.desktop,
  );
  notes.push(
    "Phone geometry remains independent. Rounded display retains exact stored values until edited; native number Escape, keyboard placement, emulated touch resize and one Undo/Redo preserve exact documents.",
  );
  // Named studies and protected flow conversion retain caption treatments and both layouts.
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.locator("#study-name").fill("Readable intervals");
  await page.getByRole("button", { name: "Keep study", exact: true }).click();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  const kept = await saved();
  await page.getByLabel("Caption size", { exact: true }).selectOption("20");
  await saved();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.getByRole("button", { name: /^Readable intervals/ }).click();
  const comparing = await read();
  await page.keyboard.press("ControlOrMeta+z");
  assert.deepEqual(await read(), comparing);
  await page
    .getByRole("button", { name: "Use this arrangement", exact: true })
    .click();
  let applied = await saved();
  assert.deepEqual(applied.pages[1].composition, kept.pages[1].composition);
  await pick("blue");
  await page.getByRole("button", { name: "Section", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview flow ↗", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return to draft", exact: true })
    .click();
  assert.deepEqual(await saved(), applied);
  await page.getByRole("button", { name: "Section", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview flow ↗", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use flow · keep placement", exact: true })
    .click();
  const flowed = await saved();
  assert.equal(flowed.pages[1].composition.mobile[0].spatial.enabled, false);
  assert.deepEqual(
    flowed.pages[1].composition.mobile[0].captions,
    applied.pages[1].composition.mobile[0].captions,
  );
  await frame()
    .locator('[data-section-id="phone-blue"]')
    .getByRole("button", { name: "Resume placement", exact: true })
    .click();
  applied = await saved();
  assert.deepEqual(applied.pages[1].composition, kept.pages[1].composition);
  await page.reload();
  assert.deepEqual(await saved(), applied);
  notes.push(
    "Named study comparison restores caption treatments and geometry; protected flow conversion retains treatments, dormant frames and a recovery study. Reload preserves the complete draft.",
  );
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  const areas = [];
  const measureAreas = () =>
    page.evaluate(() => {
      const rect = (q) => globalThis.document.querySelector(q)?.getBoundingClientRect();
      const size = (r) =>
        r
          ? {
              width: r.width,
              height: r.height,
              x: r.x,
              y: r.y,
              area: r.width * r.height,
            }
          : null;
      const side = globalThis.document.querySelector(".editor-sidebar");
      return {
        window: {
          width: globalThis.innerWidth,
          height: globalThis.innerHeight,
          area: globalThis.innerWidth * globalThis.innerHeight,
        },
        sidebar: size(
          side && !side.hidden ? side.getBoundingClientRect() : null,
        ),
        controls: size(rect(".work-context")),
        previewRegion: size(rect(".preview-stage")),
        actualPaper: size(rect(".preview-paper")),
        toolbar: size(rect(".canvas-toolbar")),
      };
    });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .getByRole("button", {
        name: width === 390 ? "Mobile preview" : "Desktop preview",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Actual viewport width", { exact: true })
      .selectOption(String(width));
    await page.waitForTimeout(350);
    await pick(width === 390 ? "blue" : "verse");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    for (const expanded of [false, true]) {
      if (expanded)
        await page
          .getByRole("button", { name: "Position", exact: true })
          .click();
      await page.waitForTimeout(150);
      const measured = await measureAreas();
      measured.controls.proportion =
        measured.controls.area / measured.window.area;
      measured.actualPaper.proportion =
        measured.actualPaper.area / measured.window.area;
      assert.ok(measured.controls.height <= Math.min(310, 1000 * 0.38) + 2);
      assert.ok(measured.previewRegion.height >= 300);
      assert.ok(
        measured.controls.y >=
          measured.previewRegion.y + measured.previewRegion.height - 1,
      );
      const targets = await page
        .locator(".spatial-actions button")
        .evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect().toJSON()),
        );
      assert.ok(targets.every((r) => r.width >= 44 && r.height >= 44));
      if (expanded) {
        assert.equal(
          await page
            .getByLabel("Across (%)", { exact: true })
            .evaluate((el) => globalThis.getComputedStyle(el).fontSize),
          "16px",
        );
        assert.ok(
          (await page.getByLabel("Across (%)", { exact: true }).boundingBox())
            .height >= 44,
        );
      }
      areas.push({ width, expanded, focused: true, targets, ...measured });
      await page.screenshot({
        path:
          evidence + `editor-${width}-${expanded ? "precision" : "quiet"}.png`,
      });
      if (expanded)
        await page
          .getByRole("button", { name: "Position", exact: true })
          .click();
    }
  }
  await page
    .getByRole("button", { name: "Exit canvas focus", exact: true })
    .click();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .getByRole("button", {
        name: width === 390 ? "Mobile preview" : "Desktop preview",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Actual viewport width", { exact: true })
      .selectOption(String(width));
    await page.waitForTimeout(300);
    await pick(width === 390 ? "blue" : "verse");
    const measured = await measureAreas();
    measured.controls.proportion =
      measured.controls.area / measured.window.area;
    measured.actualPaper.proportion =
      measured.actualPaper.area / measured.window.area;
    assert.equal(measured.sidebar, null);
    areas.push({ width, expanded: false, focused: false, ...measured });
    await page.screenshot({ path: evidence + `editor-${width}-normal.png` });
  }
  notes.push(
    "Measured actual sidebar/control/preview-paper area at 390/768/1440; the single dock sits outside the artwork. Precision is progressive and controls retain physical touch targets.",
  );
  const artifacts = await page.evaluate(async () => {
    const record = await (
      await (await import("/src/database.ts")).database()
    ).get("documents", "site");
    const release = await (
      await import("/src/revisions.ts")
    ).localRevisions.checkpoint(
      record.value,
      record.revision,
      "Readable intervals",
      { expectedId: null },
    );
    const { portableHTML, portablePackage } = await import("/src/portable.ts");
    const zip = await portablePackage(release, "original");
    return {
      html: await portableHTML(release),
      zip: Array.from(new Uint8Array(await zip.blob.arrayBuffer())),
      backup: await (
        await import("/src/storage.ts")
      ).exportBackup(record.value),
    };
  });
  await writeFile(evidence + "artist.html", artifacts.html);
  await writeFile(evidence + "artist.zip", Buffer.from(artifacts.zip));
  await writeFile(evidence + "editable-backup.json", artifacts.backup);
  await mkdir(evidence + "zip", { recursive: true });
  execFileSync("/usr/bin/unzip", [
    "-o",
    evidence + "artist.zip",
    "-d",
    evidence + "zip",
  ]);
  const published = await context.newPage(),
    exports = [];
  published.on("pageerror", (e) => errors.push(e.message));
  await published.route("**/__readable-export/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/__readable-export/",
    )[1];
    await route.fulfill({
      status: 200,
      contentType: path.endsWith(".html")
        ? "text/html"
        : path.endsWith(".svg")
          ? "image/svg+xml"
          : path.endsWith(".mp4")
            ? "video/mp4"
            : undefined,
      body:
        path === "standalone.html"
          ? artifacts.html
          : await readFile(evidence + "zip/" + path),
    });
  });
  for (const width of [390, 768, 1440])
    for (const delivery of ["standalone.html", "index.html"]) {
      await published.setViewportSize({ width, height: 1000 });
      await published.goto(
        `http://127.0.0.1:5181/__readable-export/${delivery}?page=quiet`,
      );
      await published.locator("img").evaluateAll(async (imgs) => {
        imgs.forEach((i) => (i.loading = "eager"));
        await Promise.all(imgs.map((i) => i.decode()));
      });
      await published.locator("video").evaluateAll(async (videos) =>
        Promise.all(
          videos.map((video) =>
            video.readyState >= 1
              ? Promise.resolve()
              : new Promise((resolve, reject) => {
                  video.addEventListener("loadedmetadata", resolve, {
                    once: true,
                  });
                  setTimeout(
                    () => reject(Error("Film metadata unavailable")),
                    5000,
                  );
                }),
          ),
        ),
      );
      assert.ok(
        await published
          .locator("video")
          .evaluate(
            (video) =>
              video.controls && video.videoWidth > 0 && video.duration > 0,
          ),
      );
      const sections =
        applied.pages[1].composition[width === 390 ? "mobile" : "desktop"];
      assert.deepEqual(
        await published
          .locator("[data-composition-block]")
          .evaluateAll((els) => els.map((el) => el.dataset.compositionBlock)),
        sections.flatMap((s) => s.blockIds),
      );
      assert.equal(
        await published
          .locator(".work-context,.spatial-direct-size,[data-preview-reveal]")
          .count(),
        0,
      );
      const id = width === 390 ? "blue" : "red",
        caption = published.locator(
          `[data-composition-block="${id}"] figcaption`,
        );
      const actual = await caption.evaluate((el) => ({
        size: globalThis.getComputedStyle(el).fontSize,
        backing: el.dataset.captionBacking,
        position: el.parentElement.dataset.captionPosition,
        rect: el.getBoundingClientRect().toJSON(),
      }));
      assert.equal(actual.size, width === 390 ? "14px" : "16px");
      assert.equal(actual.backing, "paper");
      if (width !== 390) assert.equal(actual.position, "above");
      exports.push({ width, delivery, caption: actual });
      await published.screenshot({
        path: evidence + `${delivery}-${width}.png`,
        fullPage: true,
      });
    }
  for (const width of [390, 768, 1440])
    assert.deepEqual(
      exports.filter((e) => e.width === width)[0].caption,
      exports.filter((e) => e.width === width)[1].caption,
    );
  assert.deepEqual(errors, []);
  notes.push(
    "Frozen release, editable v12 backup, standalone HTML and extracted ZIP retain caption treatment, source and DOM reading order on phone/tablet/desktop, with no temporary reveal or editing controls.",
  );
  await writeFile(
    evidence + "browser-results.json",
    JSON.stringify(
      {
        workspace,
        browser: browser.version(),
        results: notes,
        areas,
        exports,
        errors,
      },
      null,
      2,
    ),
  );
  notes.forEach((n) => console.log("PASS", n));
} catch (e) {
  await writeFile(
    evidence + "failure.json",
    JSON.stringify({ errors, message: String(e) }, null, 2),
  );
  await page.screenshot({ path: evidence + "failure.png" });
  throw e;
} finally {
  await browser.close();
}
