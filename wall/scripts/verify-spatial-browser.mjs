const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const evidence = fileURLToPath(
  new URL("../docs/evidence/spatial-sections/", import.meta.url),
);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    hasTouch: true,
    reducedMotion: "reduce",
  }),
  page = await context.newPage(),
  workspace = randomUUID(),
  errors = [],
  results = [],
  metrics = [];
page.on("pageerror", (e) => errors.push(e.message));
const note = (s) => {
  console.log("PASS", s);
  results.push(s);
};
try {
  await page.goto(`http://127.0.0.1:5181/?studio=${workspace}&page=quiet`);
  const original = await page.evaluate(async (workspace) => {
    if ((await import("/src/workspace.ts")).activeWorkspaceId !== workspace)
      throw Error("Refuse non-test workspace");
    const db = await (await import("/src/database.ts")).database();
    if (await db.get("documents", "site")) throw Error("Refuse existing draft");
    const { initialSite, blankBlock } = await import("/src/model.ts"),
      { sectionFor } = await import("/src/composition.ts"),
      { createTextStyle } = await import("/src/typography.ts");
    let s = structuredClone(initialSite);
    s.name = "Mira Vale";
    s.tagline = "Colour, duration & the spaces between";
    s.styleId = "gallery";
    const p = s.pages[1];
    p.title = "An interval, held open";
    p.label = "Intervals";
    p.subtitle = "Studies in light, language and quiet movement.";
    p.meta = "01 / STUDIES IN RELATION / 2026";
    p.blocks = ["blue", "verse", "film", "red"].map((id) => ({
      ...blankBlock(
        id === "verse" ? "text" : id === "film" ? "video" : "image",
      ),
      id,
      assetId:
        { blue: "formBlue", film: "studyFilm", red: "formRed" }[id] || "",
      text:
        id === "verse"
          ? "Nothing stays still\n  except the space\n\nwe leave\nfor one another."
          : "",
      caption:
        {
          blue: "I. A place for the light",
          film: "III. Two seconds of becoming",
          red: "II. The shape of an afterthought",
        }[id] || "",
      alt:
        id === "verse"
          ? ""
          : id === "film"
            ? "Original two-second colour study"
            : "Original geometric composition",
      fit: id === "red" ? "portrait" : "original",
      focal: { x: 23, y: 72 },
    }));
    p.composition = {
      enabled: true,
      desktop: [
        sectionFor(
          p.blocks.map((b) => b.id),
          "plate",
        ),
      ],
      mobile: p.blocks.map((b) => sectionFor([b.id], `phone-${b.id}`, true)),
    };
    s.pages = [s.pages[0], p];
    s = createTextStyle(
      s,
      { pageId: p.id, blockId: "verse" },
      "Intervals / verse",
      "poem",
      "verse-style",
    );
    s.textStyles[0].base.size = 26;
    s.version = 10;
    await db.put("documents", { value: s, revision: 1 }, "site");
    return s;
  }, workspace);
  const pendingMedia = [];
  await page.route("**/media/form-blue.svg", (route) =>
    pendingMedia.push(route),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const frame = () => page.frameLocator('iframe[title$="website preview"]'),
    section = (id = "plate") => frame().locator(`[data-section-id="${id}"]`),
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
      await page.waitForTimeout(160);
      return read();
    },
    content = (s) => s.pages[1].blocks,
    desktop = (s) => s.pages[1].composition.desktop,
    phone = (s) => s.pages[1].composition.mobile,
    device = async (mobile) => {
      await page
        .getByRole("button", {
          name: mobile ? "Mobile preview" : "Desktop preview",
          exact: true,
        })
        .click();
      await page.waitForTimeout(180);
    },
    choose = async (id, group = "plate") =>
      section(group)
        .getByLabel("Work to place", { exact: true })
        .selectOption(id),
    more = async (group = "plate") => {
      const d = section(group).locator(".spatial-options");
      if ((await d.getAttribute("open")) === null)
        await d.locator("summary").click();
    },
    closeMore = async (group = "plate") => {
      const d = section(group).locator(".spatial-options");
      if ((await d.getAttribute("open")) !== null)
        await d.locator("summary").click();
    },
    number = async (label, n, group = "plate") => {
      const input = section(group).getByRole("spinbutton", {
        name: label,
        exact: true,
      });
      await input.fill(String(n));
      await input.press("Tab");
      await saved();
    },
    place = async (id, x, y, width, group = "plate") => {
      await choose(id, group);
      await more(group);
      await number("Width (%)", width, group);
      await number("Across (%)", x, group);
      await number("Down (px)", y, group);
      await closeMore(group);
    },
    mediaReady = async (scope) => {
      await scope.locator("img").evaluateAll(async (imgs) => {
        for (const im of imgs) im.loading = "eager";
        await Promise.all(imgs.map((im) => im.decode()));
      });
      await scope.locator("video").evaluateAll(async (videos) =>
        Promise.all(
          videos.map((v) =>
            v.readyState >= 1
              ? Promise.resolve()
              : new Promise((resolve, reject) => {
                  v.addEventListener("loadedmetadata", resolve, { once: true });
                  setTimeout(
                    () => reject(Error("Film metadata unavailable")),
                    5000,
                  );
                }),
          ),
        ),
      );
    },
    geometry = async (scope) =>
      scope.locator(".spatial-stage").evaluate((el) => ({
        rect: el.getBoundingClientRect().toJSON(),
        grid: globalThis.getComputedStyle(el).gridTemplateColumns,
        items: [
          ...el.querySelectorAll(":scope > [data-composition-block]"),
        ].map((w) => ({
          id: w.dataset.compositionBlock,
          layer: Number(w.dataset.layer),
          r: w.getBoundingClientRect().toJSON(),
        })),
      }));
  await frame().locator("[data-composition-block]").first().waitFor();
  assert.equal((await read()).version, 10);
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  const beforeUnready = await saved();
  await section()
    .locator('[data-composition-block="blue"] img')
    .waitFor({ state: "attached" });
  await section()
    .getByRole("button", { name: "Place freely ↗", exact: true })
    .click();
  await frame()
    .getByText("The media is still loading.", { exact: false })
    .waitFor();
  assert.equal(await section().locator(".spatial-stage").count(), 0);
  assert.deepEqual(await read(), beforeUnready);
  for (const route of pendingMedia) {
    try {
      await route.continue();
    } catch (error) {
      // Focus can replace the preview document and cancel its old image request.
      if (!String(error).includes("Route is already handled")) throw error;
    }
  }
  await page.unroute("**/media/form-blue.svg");
  await mediaReady(frame());
  const flowing = await section()
    .locator(".composition-grid")
    .evaluate((el) => ({
      r: el.getBoundingClientRect().toJSON(),
      items: [...el.children].map((w) => ({
        id: w.dataset.compositionBlock,
        r: w.getBoundingClientRect().toJSON(),
      })),
    }));
  await section()
    .getByRole("button", { name: "Place freely ↗", exact: true })
    .click();
  await section().locator(".spatial-stage").waitFor();
  const first = await saved(),
    firstGeometry = await geometry(section());
  assert.equal(first.version, 11);
  assert.deepEqual(content(first), content(original));
  assert.deepEqual(phone(first), phone(original));
  assert.equal(
    firstGeometry.grid.split(" ").length,
    1,
    "free placement has one full-width containing grid cell",
  );
  for (const old of flowing.items) {
    const now = firstGeometry.items.find((w) => w.id === old.id);
    assert.ok(Math.abs(now.r.width - old.r.width) < 0.1);
    assert.ok(
      Math.abs(now.r.x - firstGeometry.rect.x - (old.r.x - flowing.r.x)) < 0.1,
    );
  }
  const recovery = await page.evaluate(async () => {
    const db = await (await import("/src/database.ts")).database();
    return db.get("documents", "pre-spatial-sections");
  });
  assert.deepEqual(recovery, { value: original, revision: 1 });
  await place("blue", 0, 0, 60);
  await place("verse", 64, 20, 34);
  await place("film", 10, 720, 52);
  await place("red", 37, 220, 30);
  let placed = await saved();
  assert.deepEqual(content(placed), content(original));
  assert.deepEqual(phone(placed), phone(original));
  const box = await geometry(section());
  for (const w of box.items) {
    assert.ok(
      w.r.left >= box.rect.left - 0.1 && w.r.right <= box.rect.right + 0.1,
    );
    assert.ok(
      w.r.bottom <= box.rect.bottom + 0.1,
      "natural height contains every work",
    );
  }
  assert.ok(
    box.items.find((w) => w.id === "red").r.left <
      box.items.find((w) => w.id === "blue").r.right,
    "intentional image overlap",
  );
  note(
    "Flow-to-placement measures real work boxes without resizing sources. Desktop image/text/film placement and intentional overlap retain phone flow, source content, crop/type and exact v10 recovery. Intrinsic section height contains every work.",
  );
  // Layering and accessible sequence are deliberately separate.
  await choose("verse");
  await more();
  await section()
    .getByRole("button", { name: "Read earlier", exact: true })
    .click();
  await saved();
  let ordered = await read();
  assert.deepEqual(desktop(ordered)[0].blockIds, [
    "verse",
    "blue",
    "film",
    "red",
  ]);
  assert.deepEqual(desktop(ordered)[0].spatial.layers, [
    "blue",
    "verse",
    "film",
    "red",
  ]);
  await section()
    .getByRole("button", { name: "Bring forward", exact: true })
    .click();
  await saved();
  assert.deepEqual(
    desktop(await read())[0].blockIds,
    desktop(ordered)[0].blockIds,
  );
  await closeMore();
  // A gesture is transient until release and costs one document Undo.
  await choose("blue");
  await more();
  await section()
    .getByLabel("Snap to nearby edges and equal gaps", { exact: true })
    .uncheck();
  await closeMore();
  const baseline = await saved(),
    move = section().getByRole("button", {
      name: "Move selected work",
      exact: true,
    });
  await move.focus();
  await page.waitForTimeout(100);
  await move.press("Shift+ArrowDown");
  await move.press("Alt+ArrowRight");
  const moved = await saved();
  assert.equal(
    desktop(moved)[0].spatial.frames.find((f) => f.blockId === "blue").y,
    10,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await saved();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), baseline);
  await move.scrollIntoViewIfNeeded();
  const mb = await move.boundingBox();
  await page.mouse.move(mb.x + 20, mb.y + 20);
  await page.mouse.down();
  await page.mouse.move(mb.x + 50, mb.y + 37, { steps: 5 });
  assert.deepEqual(
    await read(),
    baseline,
    "live gesture does not save intermediate positions",
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(await saved(), baseline);
  await move.scrollIntoViewIfNeeded();
  const mb2 = await move.boundingBox();
  await page.mouse.move(mb2.x + 20, mb2.y + 20);
  await page.mouse.down();
  await page.mouse.move(mb2.x + 75, mb2.y + 42, { steps: 6 });
  await page.mouse.up();
  assert.notDeepEqual(await saved(), baseline);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), baseline);
  // Actual artwork surface also drags; performance samples are event-to-next-animation-frame in this local browser.
  const image = section().locator('[data-composition-block="blue"]');
  await image.scrollIntoViewIfNeeded();
  const ib = await image.boundingBox();
  await image.evaluate((el) => {
    globalThis.__spatialTimings = [];
    globalThis.__spatialDOMTimings = [];
    let pending;
    el.addEventListener("pointermove", (event) => {
      const t = performance.now();
      globalThis.requestAnimationFrame(() =>
        globalThis.__spatialTimings.push(performance.now() - t),
      );
      pending?.disconnect();
      if (!(event.buttons & 1)) return;
      const previous = el.getAttribute("style");
      pending = new globalThis.MutationObserver(() => {
        if (el.getAttribute("style") === previous) return;
        globalThis.__spatialDOMTimings.push(performance.now() - t);
        pending.disconnect();
      });
      pending.observe(el, { attributes: true, attributeFilter: ["style"] });
    });
  });
  await page.mouse.move(ib.x + 20, ib.y + 20);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(ib.x + 20 + i * 3, ib.y + 20 + i * 2);
  await page.mouse.up();
  await saved();
  metrics.push({
    kind: "pointer-event-to-next-frame-ms",
    samples: await image.evaluate(() => globalThis.__spatialTimings),
  });
  metrics.push({
    kind: "pointer-event-to-work-style-commit-ms",
    samples: await image.evaluate(() => globalThis.__spatialDOMTimings),
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), baseline);
  const resize = section().getByRole("button", {
    name: "Resize selected work width",
    exact: true,
  });
  await resize.scrollIntoViewIfNeeded();
  const rb = await resize.boundingBox(),
    cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: rb.x + 20, y: rb.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: rb.x + 55, y: rb.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.notEqual(
    desktop(await saved())[0].spatial.frames[0].width,
    desktop(baseline)[0].spatial.frames[0].width,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), baseline);
  note(
    "Authored DOM order and layers are independent. Native keyboard precision, actual artwork mouse drag, emulated-touch width resize, transient previews, Escape and one Undo preserve exact documents.",
  );
  // Caption and long-text editing remain source edits, with natural height at a fixed spatial width.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const caption = section().locator(
    '[data-composition-block="blue"] figcaption .editable-copy',
  );
  await caption.click();
  await caption.fill("I. A place for the light\nA caption can take its time.");
  await caption.press("Escape");
  const captioned = await saved();
  assert.deepEqual(desktop(captioned), desktop(baseline));
  const verse = section().locator('[data-text-work="verse"]');
  await verse.click();
  const long =
    "A place for attention. ".repeat(130) + "\n\n  The last line remains.";
  await verse.fill(long);
  await verse.press("Escape");
  const stressed = await saved();
  assert.equal(content(stressed).find((b) => b.id === "verse").text, long);
  assert.deepEqual(desktop(stressed), desktop(captioned));
  const tall = await geometry(section());
  assert.ok(tall.rect.height > 1200);
  for (const w of tall.items) assert.ok(w.r.bottom <= tall.rect.bottom + 0.1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await saved(), captioned);
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await choose("verse");
  await closeMore();
  await frame()
    .locator(".artist-site")
    .evaluate((el) =>
      el.ownerDocument.defaultView.scrollTo({ top: 0, behavior: "instant" }),
    );
  await page.waitForTimeout(120);
  await page.screenshot({ path: evidence + "desktop-canvas.png" });
  note(
    "Caption edits and 2,800+ characters of multiline writing keep placement/crops/type untouched. Content grows downward and expands the section; Undo restores the exact manuscript.",
  );
  // Independent phone placement can be tried and explicitly returned to flow.
  const beforePhone = await saved();
  await device(true);
  assert.equal(await frame().locator(".spatial-stage").count(), 0);
  await section("phone-blue")
    .getByRole("button", { name: "Place freely ↗", exact: true })
    .click();
  await place("blue", 10, 30, 80, "phone-blue");
  assert.deepEqual(desktop(await saved()), desktop(beforePhone));
  await section("phone-blue")
    .getByRole("button", { name: "Preview flow ↗", exact: true })
    .click();
  const frozen = await read();
  assert.ok(
    await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(),
  );
  await page.keyboard.press("ControlOrMeta+z");
  assert.deepEqual(await read(), frozen);
  await page
    .getByRole("button", { name: "Return to draft", exact: true })
    .click();
  assert.deepEqual(await saved(), frozen);
  await section("phone-blue")
    .getByRole("button", { name: "Preview flow ↗", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use flow · keep placement", exact: true })
    .click();
  let phoneFlow = await saved();
  assert.equal(phone(phoneFlow)[0].spatial.enabled, false);
  assert.deepEqual(desktop(phoneFlow), desktop(beforePhone));
  assert.ok(
    phoneFlow.pages[1].studies.some(
      (s) => s.name === "Spatial before phone flow",
    ),
  );
  await device(false);
  const beforeFlow = await saved();
  await section()
    .getByRole("button", { name: "Preview flow ↗", exact: true })
    .click();
  await page.screenshot({ path: evidence + "flow-comparison.png" });
  assert.deepEqual(await read(), beforeFlow);
  await page
    .getByRole("button", { name: "Use flow · keep placement", exact: true })
    .click();
  const flowed = await saved();
  assert.equal(desktop(flowed)[0].spatial.enabled, false);
  assert.deepEqual(
    desktop(flowed)[0].spatial.frames,
    desktop(beforeFlow)[0].spatial.frames,
  );
  await page.reload();
  await saved();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await section()
    .getByRole("button", { name: "Resume placement", exact: true })
    .click();
  assert.deepEqual(desktop(await saved()), desktop(beforeFlow));
  note(
    "Phone can independently place one work or flow. Conversion uses protected read-only A/B, blocks Undo while comparing, retains a named spatial study and dormant geometry, and resumes exact placement after reload.",
  );
  // Save/apply a named study after a later caption change: arrangement is restored, latest source retained.
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.locator("#study-name").fill("An open interval");
  await page.getByRole("button", { name: "Keep study", exact: true }).click();
  await saved();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  const kept = await saved();
  await choose("red");
  await section()
    .getByRole("button", { name: "Move selected work", exact: true })
    .press("Shift+ArrowDown");
  await saved();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await caption.click();
  await caption.fill("I. A place for the light\nThe words remain live.");
  await caption.press("Escape");
  const latest = await saved();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.getByRole("button", { name: /^An open interval/ }).click();
  assert.deepEqual(await read(), latest);
  await page
    .getByRole("button", { name: "Use this arrangement", exact: true })
    .click();
  const applied = await saved();
  assert.deepEqual(applied.pages[1].composition, kept.pages[1].composition);
  assert.deepEqual(content(applied), content(latest));
  await page.reload();
  assert.deepEqual(await saved(), applied);
  // Check focused editing controls in both physical and scaled preview sizes.
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await device(false);
    await section()
      .getByRole("button", { name: "Resize selected work width", exact: true })
      .scrollIntoViewIfNeeded();
    const control = await section()
      .getByRole("button", { name: "Resize selected work width", exact: true })
      .boundingBox();
    assert.ok(control.width >= 43.5 && control.height >= 43.5);
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth + 1,
      ),
    );
    metrics.push({
      editorWidth: width,
      control,
      stage: await page.locator(".preview-stage").boundingBox(),
    });
    await page.screenshot({ path: evidence + `editor-${width}.png` });
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  assert.equal(
    await page
      .locator('iframe[title$="website preview"]')
      .evaluate((el) => el.contentWindow.innerWidth),
    1024,
  );
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  assert.deepEqual(await saved(), applied);
  note(
    "Named studies restore frames, layer order and both device modes while keeping newer captions. Reload, Focus, Fit/100%, reduced-motion and 44px controls at 390/768/1440 preserve the draft.",
  );
  const artifacts = await page.evaluate(async () => {
    const record = await (
      await (await import("/src/database.ts")).database()
    ).get("documents", "site");
    const { localRevisions } = await import("/src/revisions.ts"),
      { portableHTML, portablePackage } = await import("/src/portable.ts"),
      { exportBackup } = await import("/src/storage.ts");
    const release = await localRevisions.checkpoint(
        record.value,
        record.revision,
        "An interval, held open",
        { expectedId: null },
      ),
      zip = await portablePackage(release, "original");
    return {
      html: await portableHTML(release),
      zip: Array.from(new Uint8Array(await zip.blob.arrayBuffer())),
      backup: await exportBackup(record.value),
    };
  });
  await writeFile(evidence + "spatial-artist.html", artifacts.html);
  await writeFile(evidence + "spatial-artist.zip", Buffer.from(artifacts.zip));
  await writeFile(evidence + "editable-backup.json", artifacts.backup);
  assert.deepEqual(JSON.parse(artifacts.backup).site, applied);
  await mkdir(evidence + "zip", { recursive: true });
  execFileSync("/usr/bin/unzip", [
    "-o",
    evidence + "spatial-artist.zip",
    "-d",
    evidence + "zip",
  ]);
  const exported = await context.newPage();
  exported.on("pageerror", (e) => errors.push(e.message));
  await exported.route("**/__spatial-export/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/__spatial-export/",
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
  const exports = [];
  for (const delivery of ["standalone.html", "index.html"])
    for (const width of [390, 1440]) {
      await exported.setViewportSize({ width, height: 1000 });
      await exported.goto(
        `http://127.0.0.1:5181/__spatial-export/${delivery}?page=quiet`,
      );
      await exported.locator('[data-composition-block="blue"]').waitFor();
      await mediaReady(exported);
      const mobile = width === 390,
        order = await exported
          .locator("[data-composition-block]")
          .evaluateAll((els) => els.map((el) => el.dataset.compositionBlock));
      assert.deepEqual(
        order,
        (mobile ? phone(applied) : desktop(applied)).flatMap((s) => s.blockIds),
      );
      assert.equal(
        await exported
          .locator(
            "button[data-spatial-action],.spatial-tools,.spatial-floor,.canvas-section-tools",
          )
          .count(),
        0,
      );
      const source = await exported
        .locator('[data-text-work="verse"]')
        .textContent();
      assert.equal(source, content(applied).find((b) => b.id === "verse").text);
      assert.equal(
        await exported.locator("video").getAttribute("controls"),
        "",
      );
      assert.equal(
        await exported
          .locator("video")
          .evaluate((v) => v.videoWidth > 0 && v.videoHeight > 0),
        true,
      );
      if (mobile)
        assert.equal(await exported.locator(".spatial-stage").count(), 0);
      else {
        const geo = await geometry(exported);
        for (const expected of desktop(applied)[0].spatial.frames) {
          const actual = geo.items.find((w) => w.id === expected.blockId);
          assert.ok(
            Math.abs(
              ((actual.r.x - geo.rect.x) * 100) / geo.rect.width - expected.x,
            ) < 0.02,
          );
          assert.ok(
            Math.abs((actual.r.width * 100) / geo.rect.width - expected.width) <
              0.02,
          );
          assert.ok(Math.abs(actual.r.y - geo.rect.y - expected.y) < 0.1);
          assert.ok(actual.r.bottom <= geo.rect.bottom + 0.1);
          assert.equal(
            actual.layer,
            desktop(applied)[0].spatial.layers.indexOf(expected.blockId) + 1,
          );
        }
        exports.push({ delivery, width, geometry: geo });
      }
      assert.equal(
        await exported
          .locator('[data-composition-block="blue"] img')
          .evaluate((el) => el.style.objectPosition),
        "23% 72%",
      );
      await exported.screenshot({
        path: evidence + `${delivery}-${width}.png`,
        fullPage: true,
      });
    }
  assert.deepEqual(exports[0].geometry, exports[1].geometry);
  assert.deepEqual(errors, []);
  note(
    "Frozen local release, editable v11 backup, standalone HTML and extracted ZIP preserve spatial geometry/layers, accessible reading order, live captions/type/crops, independent phone flow and native playable film.",
  );
  const times =
    metrics
      .find((m) => m.samples)
      ?.samples.slice()
      .sort((a, b) => a - b) || [];
  await writeFile(
    evidence + "browser-results.json",
    JSON.stringify(
      {
        browser: browser.version(),
        workspace,
        results,
        metrics,
        latency: {
          samples: times.length,
          p50: times[Math.floor(times.length * 0.5)],
          p95: times[Math.floor(times.length * 0.95)],
          meaning:
            "Pointer event to next requestAnimationFrame callback on this Mac; not end-to-end display latency.",
        },
        exports,
        errors,
      },
      null,
      2,
    ),
  );
} catch (e) {
  await page.screenshot({ path: evidence + "failure.png" });
  await writeFile(evidence + "failure.txt", String(e));
  throw e;
} finally {
  await browser.close();
}
