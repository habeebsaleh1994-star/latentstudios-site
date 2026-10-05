const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const evidence = fileURLToPath(
  new URL(
    "../docs/evidence/selection-readability/type-regression/",
    import.meta.url,
  ),
);
await mkdir(evidence, { recursive: true });
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
    const { initialSite, blankBlock } = await import("/src/model.ts"),
      { sectionFor } = await import("/src/composition.ts");
    const s = structuredClone(initialSite);
    s.version = 9;
    delete s.textStyles;
    s.name = "Mira Vale";
    s.styleId = "gallery";
    const p = s.pages[1];
    p.title = "A room for the words";
    p.subtitle = "Poems, a statement, and notes in the margin.";
    p.blocks = ["poem", "note", "statement", "echo", "inherited", "image"].map(
      (id) => ({
        ...blankBlock(id === "image" ? "image" : "text"),
        id,
        text:
          {
            poem: "The room is quiet\n  except for the light\n\nwhich has no name.",
            statement:
              "I work with what remains after an image has been seen. A colour, a pause, a sentence that does not quite end. These studies are invitations to look again.",
            note: "Field note 04\nAn interval is also a place.",
            echo: "Some words return\n  in another room.",
            inherited: "This line follows the site identity.",
          }[id] || "",
        assetId: id === "image" ? "formBlue" : "",
        caption: id === "image" ? "A colour becomes a place." : "",
        alt: id === "image" ? "Original synthetic geometric composition" : "",
        fit: "landscape",
        focal: { x: 23, y: 72 },
      }),
    );
    p.composition = {
      enabled: true,
      desktop: [
        { ...sectionFor(["poem", "note"], "pair"), width: "wide" },
        ...["statement", "echo", "inherited", "image"].map((id) =>
          sectionFor([id], id),
        ),
      ],
      mobile: [
        {
          ...sectionFor(["poem", "note"], "phone-pair", true),
          layout: "columns",
        },
        ...["statement", "echo", "inherited", "image"].map((id) =>
          sectionFor([id], `phone-${id}`, true),
        ),
      ],
    };
    s.pages = [s.pages[0], p];
    await db.put("documents", { value: s, revision: 1 }, "site");
    return s;
  }, workspace);
  await page.reload();
  const frame = () => page.frameLocator('iframe[title$="website preview"]'),
    read = () =>
      page.evaluate(
        async () =>
          (
            await (
              await (await import("/src/database.ts")).database()
            ).get("documents", "site")
          ).value,
      ),
    wait = async () => {
      await page.getByText("Saved on this device", { exact: true }).waitFor();
      await page.waitForTimeout(150);
      return read();
    },
    active = (s) => s.pages[1],
    block = (s, id) => active(s).blocks.find((b) => b.id === id),
    text = (id) => frame().locator(`[data-text-work="${id}"]`),
    dialog = () =>
      page.getByRole("dialog", { name: "Style this writing", exact: true });
  const open = async (id) => {
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await text(id).click();
    await page
      .getByRole("button", { name: "Style this writing", exact: true })
      .click();
    await dialog().waitFor();
  };
  const close = async () => {
    await page
      .getByRole("button", { name: "Close writing style", exact: true })
      .click();
    await wait();
  };
  const number = async (name, value) => {
    const input = dialog().getByRole("spinbutton", { name, exact: true });
    await input.fill(String(value));
    await input.press("Tab");
    await wait();
  };
  const device = async (mobile) => {
    await page
      .getByRole("button", {
        name: mobile ? "Mobile preview" : "Desktop preview",
        exact: true,
      })
      .click();
    await page.waitForTimeout(120);
  };
  await text("poem").waitFor();
  assert.equal((await read()).version, 9);
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  for (const [id, name, role] of [
    ["poem", "Verse", "poem"],
    ["statement", "Artist statement", "statement"],
    ["note", "Margin", "note"],
  ]) {
    await open(id);
    await dialog()
      .getByRole("button", { name: /Create a named style/ })
      .click();
    await dialog()
      .getByRole("textbox", { name: "New text style name", exact: true })
      .fill(name);
    await dialog()
      .getByLabel("New text style role", { exact: true })
      .selectOption(role);
    await dialog()
      .getByRole("button", { name: "Create and use style", exact: true })
      .click();
    await close();
  }
  let styled = await wait();
  assert.equal(styled.version, 13);
  assert.deepEqual(
    await page.evaluate(
      async () =>
        (
          await (
            await (await import("/src/database.ts")).database()
          ).get("documents", "pre-local-expression")
        ).value,
    ),
    legacy,
  );
  assert.equal(styled.textStyles.length, 3);
  assert.equal(block(styled, "inherited").typography, undefined);
  assert.deepEqual(
    active(styled).blocks.map((b) => b.text),
    active(legacy).blocks.map((b) => b.text),
  );
  await open("echo");
  await dialog()
    .getByLabel("Use a named text style", { exact: true })
    .selectOption({ label: "Verse · poem" });
  await close();
  await open("poem");
  await dialog()
    .getByRole("button", { name: "Named style · 2", exact: true })
    .click();
  await dialog()
    .getByLabel("Text font family", { exact: true })
    .selectOption("humanist");
  await number("Text size", 30);
  await close();
  styled = await wait();
  assert.equal(
    await text("poem").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "30px",
  );
  assert.equal(
    await text("echo").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "30px",
  );
  assert.equal(
    await text("statement").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "20px",
  );
  assert.equal(
    await text("note").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "14px",
  );
  note(
    "Created poem, statement and marginal-note styles through the focused UI; a reused style changes only its two explicit subscribers. Source words and exact v9 recovery remain intact.",
  );
  await open("poem");
  await number("Text size", 32);
  await dialog()
    .getByRole("button", { name: "Named style · 2", exact: true })
    .click();
  await number("Text size", 29);
  await dialog()
    .getByRole("button", { name: "This work", exact: true })
    .click();
  await close();
  assert.equal(
    await text("poem").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "32px",
  );
  assert.equal(
    await text("echo").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "29px",
  );
  await open("poem");
  await dialog()
    .getByRole("button", {
      name: "Reset local overrides · all devices",
      exact: true,
    })
    .click();
  await close();
  assert.equal(
    await text("poem").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "29px",
  );
  await open("note");
  await number("Text size", 10);
  await dialog().getByLabel("Readability advice", { exact: true }).waitFor();
  assert.equal(block(await wait(), "note").typography.base.size, 10);
  await dialog()
    .getByRole("button", { name: "Undo style edit", exact: true })
    .click();
  await close();
  assert.equal(
    await text("note").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "14px",
  );
  await open("poem");
  await dialog()
    .getByLabel("Typography device scope", { exact: true })
    .selectOption("mobile");
  await number("Text size", 19);
  await number("Line height", 1.9);
  await dialog()
    .getByText("Spacing, alignment & line breaks", { exact: true })
    .click();
  await number("Line measure", 24);
  await number("Letter spacing", 0.01);
  await dialog()
    .getByLabel("Text alignment", { exact: true })
    .selectOption("start");
  await page.screenshot({ path: evidence + "phone-type-controls.png" });
  await close();
  const phoneType = structuredClone(
    block(await wait(), "poem").typography.mobile,
  );
  await text("poem").click();
  await text("poem").fill(
    "small voice\n  keep this space\n\nand this silence.",
  );
  await text("poem").press("Escape");
  let authored = await wait();
  assert.deepEqual(block(authored, "poem").typography.mobile, phoneType);
  assert.equal(
    await text("poem").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "19px",
  );
  await device(false);
  assert.equal(
    await text("poem").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "29px",
  );
  assert.equal(
    await text("poem").textContent(),
    "small voice\n  keep this space\n\nand this silence.",
  );
  await device(true);
  await open("poem");
  await dialog()
    .getByRole("button", { name: "Reset local overrides · phone", exact: true })
    .click();
  await dialog()
    .getByRole("button", { name: "Undo style edit", exact: true })
    .click();
  await close();
  assert.deepEqual(block(await wait(), "poem").typography.mobile, phoneType);
  note(
    "Local overrides take priority; reset returns to live style inheritance. Readability advice keeps artist choices. Phone-only size, leading, measure and tracking survive shared text editing and exact Undo.",
  );
  // Global scope remains explicit and affects only inherited values.
  await device(false);
  await open("inherited");
  await close();
  await page
    .getByRole("button", { name: "Show inspector", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Global identity · all pages ↗",
      exact: true,
    })
    .click();
  const scale = page.getByRole("slider", {
    name: "Reading scale",
    exact: true,
  });
  await scale.press("End");
  for (let n = 0; n < 5; n++) await scale.press("ArrowLeft");
  await wait();
  assert.ok(
    Math.abs(
      parseFloat(
        await text("inherited").evaluate(
          (el) => globalThis.getComputedStyle(el).fontSize,
        ),
      ) - 26.4,
    ) < 0.01,
  );
  assert.equal(
    await text("poem").evaluate(
      (el) => globalThis.getComputedStyle(el).fontSize,
    ),
    "29px",
  );
  // Poster must never capitalize the underlying source during editing.
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Use Poster style", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await text("poem").click();
  await text("poem").fill(
    "small voice\n  keep this space\n\nand this silence.",
  );
  await text("poem").press("Escape");
  assert.equal(
    block(await wait(), "poem").text,
    "small voice\n  keep this space\n\nand this silence.",
  );
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await page
    .getByRole("button", { name: "Use Gallery style", exact: true })
    .click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  note(
    "Global identity changes inherited reading size without rewriting named/local sizes; actual Poster editing retains original lowercase and intentional line breaks.",
  );
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  const handle = (id, kind) =>
    frame().locator(`[data-section-id="${id}"] [data-canvas-action="${kind}"]`);
  const key = async (id, kind, keys) => {
    const h = handle(id, kind);
    await h.scrollIntoViewIfNeeded();
    await h.focus();
    await page.waitForTimeout(100);
    for (const k of keys) await h.press(k);
    return wait();
  };
  let precise = await key("pair", "width", [
    "ArrowLeft",
    "ArrowLeft",
    "ArrowLeft",
    "Shift+ArrowRight",
    "Alt+ArrowLeft",
  ]);
  assert.equal(active(precise).composition.desktop[0].widthPercent, 85.9);
  precise = await key("pair", "ratio", [
    "ArrowRight",
    "Alt+ArrowRight",
    "Shift+ArrowRight",
  ]);
  assert.equal(active(precise).composition.desktop[0].columnRatio, 56.1);
  const savedDesktop = structuredClone(active(precise).composition.desktop);
  const image = structuredClone(block(precise, "image"));
  await page.screenshot({ path: evidence + "desktop-fine-proportions.png" });
  await device(true);
  precise = await key("phone-pair", "width", ["ArrowLeft", "Alt+ArrowLeft"]);
  assert.equal(active(precise).composition.mobile[0].widthPercent, 98.9);
  precise = await key("phone-pair", "ratio", ["ArrowLeft", "Alt+ArrowLeft"]);
  assert.equal(active(precise).composition.mobile[0].columnRatio, 48.9);
  assert.deepEqual(active(precise).composition.desktop, savedDesktop);
  assert.deepEqual(block(precise, "image"), image);
  // Real emulated touch adjusts a phone ratio continuously, then one Undo restores its exact prior value.
  const h = handle("phone-pair", "ratio");
  await h.scrollIntoViewIfNeeded();
  const r = await h.boundingBox(),
    cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: r.x + 20, y: r.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: r.x + 33, y: r.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const touched = await wait();
  assert.notEqual(active(touched).composition.mobile[0].columnRatio, 48.9);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await wait(), precise);
  await handle("phone-pair", "width").focus();
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.press("Escape");
  await page.keyboard.up("ArrowLeft");
  assert.deepEqual(await wait(), precise);
  await page.getByRole("button", { name: "Guides", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Guides", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await handle("phone-pair", "ratio").scrollIntoViewIfNeeded();
    const b = await handle("phone-pair", "ratio").boundingBox();
    assert.ok(b.width >= 43.5 && b.height >= 43.5);
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth + 1,
      ),
    );
  }
  note(
    "Desktop 85.9% / 56.1:43.9 and phone 98.9% / 48.9:51.1 are precise, independent and crop-safe. Touch adjustment, one Undo, Escape and 44px controls pass at phone/tablet/desktop editor sizes.",
  );
  await page
    .getByRole("button", { name: "Exit canvas focus", exact: true })
    .click();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.locator("#study-name").fill("Precise proportions");
  await page.getByRole("button", { name: "Keep study", exact: true }).click();
  await wait();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await key("phone-pair", "ratio", ["Shift+ArrowRight"]);
  await open("poem");
  await dialog()
    .getByLabel("Text font family", { exact: true })
    .selectOption("mono");
  await close();
  await text("poem").click();
  await text("poem").fill(
    "small voice\n  keep this space\n\nand a new silence.",
  );
  await text("poem").press("Escape");
  const latest = await wait();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.getByRole("button", { name: /^Precise proportions/ }).click();
  assert.equal(
    await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Use this arrangement", exact: true })
    .click();
  const applied = await wait();
  assert.deepEqual(active(applied).composition, active(precise).composition);
  assert.deepEqual(active(applied).blocks, active(latest).blocks);
  assert.deepEqual(applied.textStyles, latest.textStyles);
  await page.reload();
  assert.deepEqual(await wait(), applied);
  note(
    "Composition study Apply restores both precise layouts while retaining latest shared words, named styles and phone-specific typography; reload preserves all of it.",
  );
  const artifacts = await page.evaluate(async () => {
    const record = await (
      await (await import("/src/database.ts")).database()
    ).get("documents", "site");
    const { collectMedia } = await import("/src/revisions.ts"),
      { portableHTML, portablePackage } = await import("/src/portable.ts"),
      { exportBackup } = await import("/src/storage.ts");
    const release = {
        format: "latent-studio-revision",
        version: 1,
        id: "local-expression-proof",
        name: "Synthetic typography proof",
        createdAt: new Date().toISOString(),
        sourceRevision: record.revision,
        site: record.value,
        ...(await collectMedia(record.value)),
      },
      zip = await portablePackage(release, "original");
    return {
      html: await portableHTML(release),
      zip: Array.from(new Uint8Array(await zip.blob.arrayBuffer())),
      backup: await exportBackup(record.value),
    };
  });
  await writeFile(evidence + "artist-typography.html", artifacts.html);
  await writeFile(
    evidence + "artist-typography.zip",
    Buffer.from(artifacts.zip),
  );
  await writeFile(evidence + "editable-backup.json", artifacts.backup);
  assert.deepEqual(JSON.parse(artifacts.backup).site, applied);
  await mkdir(evidence + "zip", { recursive: true });
  execFileSync("/usr/bin/unzip", [
    "-o",
    evidence + "artist-typography.zip",
    "-d",
    evidence + "zip",
  ]);
  const exported = await context.newPage();
  exported.on("pageerror", (e) => errors.push(e.message));
  await exported.route("**/__type-export/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/__type-export/",
    )[1];
    await route.fulfill({
      status: 200,
      contentType: path.endsWith(".html")
        ? "text/html"
        : path.endsWith(".svg")
          ? "image/svg+xml"
          : undefined,
      body:
        path === "standalone.html"
          ? artifacts.html
          : await readFile(evidence + "zip/" + path),
    });
  });
  const measurements = [];
  for (const delivery of ["standalone.html", "index.html"])
    for (const width of [390, 1440]) {
      await exported.setViewportSize({ width, height: 1000 });
      await exported.goto(
        `http://127.0.0.1:5181/__type-export/${delivery}?page=quiet`,
      );
      await exported.locator('[data-text-work="poem"]').waitFor();
      await exported.locator("img").evaluateAll(async (els) => {
        for (const el of els) el.loading = "eager";
        await Promise.all(els.map((el) => el.decode()));
      });
      const mobile = width === 390;
      const actual = await exported
        .locator("[data-text-work]")
        .evaluateAll((els) =>
          els.map((el) => {
            const s = globalThis.getComputedStyle(el);
            return {
              id: el.dataset.textWork,
              text: el.textContent,
              font: s.fontFamily,
              size: s.fontSize,
              leading: s.lineHeight,
              tracking: s.letterSpacing,
              align: s.textAlign,
              flow: s.whiteSpace,
              measure: s.maxWidth,
            };
          }),
        );
      const poem = actual.find((t) => t.id === "poem");
      assert.equal(poem.size, mobile ? "19px" : "29px");
      assert.equal(poem.flow, "pre-wrap");
      assert.equal(poem.text, block(applied, "poem").text);
      assert.ok(poem.font.includes(mobile ? "Courier" : "Palatino"));
      assert.equal(poem.leading, mobile ? "36.1px" : "47.85px");
      assert.equal(actual.find((t) => t.id === "statement").size, "20px");
      assert.equal(actual.find((t) => t.id === "note").size, "14px");
      assert.equal(actual.find((t) => t.id === "echo").size, "29px");
      const geometry = await exported
        .locator(`[data-section-id="${mobile ? "phone-pair" : "pair"}"]`)
        .evaluate((el) => {
          const grid = el.querySelector(".composition-grid"),
            cs = globalThis.getComputedStyle(grid),
            children = [...grid.children];
          return {
            width: el.style.getPropertyValue("--section-width"),
            ratio:
              (children[0].getBoundingClientRect().width /
                (grid.getBoundingClientRect().width -
                  parseFloat(cs.columnGap))) *
              100,
          };
        });
      assert.equal(geometry.width, mobile ? "98.9%" : "85.9%");
      assert.ok(Math.abs(geometry.ratio - (mobile ? 48.9 : 56.1)) < 0.1);
      assert.equal(await exported.locator("[data-canvas-action]").count(), 0);
      assert.equal(
        await exported.locator("img").evaluate((el) => el.style.objectPosition),
        "23% 72%",
      );
      measurements.push({ delivery, width, actual, geometry });
      await exported.screenshot({
        path: evidence + `${delivery}-${width}.png`,
        fullPage: true,
      });
    }
  assert.deepEqual(measurements[0].actual, measurements[2].actual);
  assert.deepEqual(measurements[1].actual, measurements[3].actual);
  assert.deepEqual(errors, []);
  note(
    "Actual standalone HTML and extracted ZIP preserve source breaks/case, all named/local/phone type values, fine width and ratios, and image focal point at 390/1440. Editable v12 backup matches the saved document.",
  );
  await writeFile(
    evidence + "browser-results.json",
    JSON.stringify(
      { browser: browser.version(), workspace, results, measurements, errors },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: evidence + "failure.png" });
  await writeFile(evidence + "failure.txt", String(error));
  throw error;
} finally {
  await browser.close();
}
