import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
const evidence = fileURLToPath(
  new URL("../docs/evidence/relationships/", import.meta.url),
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
  errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("BROWSER ERROR", e.message);
});
const shot = async (name) =>
  page.screenshot({ path: `${evidence}${name}.png` });
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
  await page.waitForTimeout(200);
  return read();
};
try {
  await page.goto(`http://127.0.0.1:5181/?studio=${workspace}&page=quiet`);
  await page.evaluate(async (workspace) => {
    const { activeWorkspaceId } = await import("/src/workspace.ts");
    if (activeWorkspaceId !== workspace)
      throw Error("Refuse non-test workspace");
    const db = await (await import("/src/database.ts")).database();
    if (await db.get("documents", "site")) throw Error("Refuse existing draft");
    const { initialSite } = await import("/src/model.ts"),
      { sectionFor } = await import("/src/composition.ts");
    const s = structuredClone(initialSite),
      p = s.pages.find((p) => p.id === "quiet");
    const image = {
      ...p.blocks.find((b) => b.type === "image"),
      id: "relationship-image",
      assetId: "formBlue",
      fit: "original",
      focal: { x: 23, y: 67 },
      caption: "A blue interval, 2026",
      alt: "Original blue geometric study",
    };
    const text = {
      ...p.blocks.find((b) => b.type === "text"),
      id: "relationship-writing",
      text: "The space between things\nis also a place.\n\nI leave room\nfor what I cannot name.",
      typography: {
        styleId: null,
        base: { size: 24, measure: 34, flow: "poem", leading: 1.5 },
        mobile: { size: 18, measure: 28 },
      },
    };
    p.blocks = [text, image];
    p.studies = [];
    const desktop = {
      ...sectionFor([text.id, image.id], "relationship-section"),
      captions: [{ blockId: image.id, size: 14, backing: "paper" }],
      spatial: {
        enabled: true,
        minHeight: 580,
        frames: [
          { blockId: image.id, x: 0, y: 0, width: 55 },
          { blockId: text.id, x: 61, y: 18, width: 37 },
        ],
        layers: [image.id, text.id],
      },
    };
    const mobile = {
      ...sectionFor([text.id, image.id], "relationship-phone", true),
      captions: [{ blockId: image.id, size: 14, position: "above" }],
      spatial: {
        enabled: true,
        minHeight: 640,
        frames: [
          { blockId: image.id, x: 0, y: 0, width: 100 },
          { blockId: text.id, x: 8, y: 370, width: 84 },
        ],
        layers: [image.id, text.id],
      },
    };
    p.composition = { enabled: true, desktop: [desktop], mobile: [mobile] };
    s.pages = [s.pages[0], p];
    s.name = "Ari Vale";
    s.version = 12;
    await db.put("documents", { value: s, revision: 1 }, "site");
  }, workspace);
  await page.reload();
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: "Focus canvas", exact: true }).click();
  await page.locator(".work-picker-toggle").click();
  await page.locator('[data-work-picker="relationship-image"]').click();
  const before = await saved();
  await writeFile(
    `${evidence}source-before.json`,
    JSON.stringify(before, null, 2),
  );
  await shot("selected-pair");
  await page
    .getByRole("button", { name: "Explore image + writing ↗", exact: true })
    .click();
  await page
    .getByLabel("Relationship scope", { exact: true })
    .selectOption("both");
  await page
    .getByRole("button", { name: "Explore compositions", exact: true })
    .click();
  await page.getByText(/3 valid alternatives/).waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  await shot("three-alternatives-desktop");
  assert.deepEqual(await read(), before);
  for (const name of [
    "In conversation",
    "The image leads",
    "A reading sequence",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(400);
    await shot(`candidate-${name.toLowerCase().replaceAll(" ", "-")}`);
  }
  await page
    .getByLabel("Relationship preview width", { exact: true })
    .selectOption("390");
  await page.waitForTimeout(500);
  await shot("candidate-phone");
  const measurements = [];
  for (const name of [
    "In conversation",
    "The image leads",
    "A reading sequence",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    for (const width of [768, 1440, 390]) {
      await page
        .getByLabel("Relationship preview width", { exact: true })
        .selectOption(String(width));
      const frame = page.frameLocator(
        `iframe[title="${name} relationship preview"]`,
      );
      await frame
        .locator('[data-composition-block="relationship-writing"]')
        .waitFor();
      await page.waitForTimeout(300);
      const metric = await frame
        .locator(".composition-section")
        .evaluate((el) => ({
          order: [...el.querySelectorAll("[data-composition-block]")].map(
            (n) => n.dataset.compositionBlock,
          ),
          boxes: [...el.querySelectorAll("[data-composition-block]")].map(
            (n) => ({
              id: n.dataset.compositionBlock,
              ...n.getBoundingClientRect().toJSON(),
            }),
          ),
          font: el.ownerDocument.defaultView.getComputedStyle(
            el.querySelector(".direction-prose"),
          ).fontSize,
          caption: el.querySelector("figcaption").textContent,
        }));
      assert.deepEqual(metric.order, [
        "relationship-image",
        "relationship-writing",
      ]);
      assert.equal(metric.font, width === 390 ? "18px" : "24px");
      measurements.push({ name, width, ...metric });
    }
  }
  for (const width of [768, 1440, 390])
    assert.equal(
      new Set(
        measurements
          .filter((m) => m.width === width)
          .map((m) => JSON.stringify(m.boxes.map((b) => [b.width, b.height]))),
      ).size,
      3,
    );
  await page.keyboard.press("ControlOrMeta+z");
  assert.deepEqual(await read(), before);
  await page.getByText("Preserve current placement", { exact: true }).click();
  await page
    .getByLabel("Hold this pair’s current sections", { exact: false })
    .check();
  await page
    .getByRole("button", { name: "Explore compositions", exact: true })
    .click();
  await page.getByText(/0 valid alternatives/).waitFor();
  assert.match(
    await page.locator(".relationship-stage").innerText(),
    /placement conflicts/,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Apply alternative", exact: true })
      .isEnabled(),
    false,
  );
  await shot("placement-conflict");
  assert.deepEqual(await read(), before);
  await page
    .getByLabel("Hold this pair’s current sections", { exact: false })
    .uncheck();
  await page
    .getByRole("button", { name: "Explore compositions", exact: true })
    .click();
  await page.getByText(/3 valid alternatives/).waitFor();
  await page
    .getByRole("button", { name: "In conversation", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByLabel("Relationship preview width", { exact: true })
    .selectOption("390");
  await page
    .getByLabel("Phone composition alternative", { exact: true })
    .selectOption("sequence");
  await page
    .getByLabel("Phone composition alternative", { exact: true })
    .selectOption("balance");
  await page.waitForTimeout(450);
  await shot("phone-exploration");
  const phoneMetrics = await page
    .locator(".relationship-explorer")
    .evaluate((el) => ({
      width: el.clientWidth,
      scrollWidth: el.scrollWidth,
      formVisible: el
        .querySelector(".relationship-intentions")
        .getBoundingClientRect().height,
      paper: el
        .querySelector(".relationship-paper")
        .getBoundingClientRect()
        .toJSON(),
      footer: el.querySelector("footer").getBoundingClientRect().toJSON(),
    }));
  assert.equal(phoneMetrics.width, phoneMetrics.scrollWidth);
  assert.equal(phoneMetrics.formVisible, 0);
  await page
    .getByRole("button", { name: "Apply In conversation", exact: true })
    .tap();
  const applied = await saved();
  assert.equal(applied.version, 13);
  assert.equal(applied.pages[1].intentions.length, 2);
  const byId = (p) => Object.fromEntries(p.blocks.map((b) => [b.id, b]));
  assert.deepEqual(byId(applied.pages[1]), byId(before.pages[1]));
  assert.deepEqual(applied.appearances, before.appearances);
  assert.equal(
    applied.pages[1].studies.length,
    before.pages[1].studies.length + 1,
  );
  assert.equal(
    await page.locator(".work-context").getAttribute("data-work-id"),
    "relationship-image",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  assert.deepEqual(await saved(), before);
  await page.getByRole("button", { name: "Redo", exact: true }).first().click();
  assert.deepEqual(await saved(), applied);
  await shot("phone-applied");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Explore image + writing ↗", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore compositions", exact: true })
    .click();
  await page.getByText(/valid alternatives/).waitFor();
  await page
    .frameLocator('iframe[title="In conversation relationship preview"]')
    .locator("img")
    .click();
  await page.keyboard.press("Escape");
  assert.deepEqual(await saved(), applied);
  await page
    .getByRole("button", {
      name: "Remove together intention for both",
      exact: true,
    })
    .click();
  const removed = await saved();
  assert.equal(removed.pages[1].intentions.length, 1);
  assert.deepEqual(removed.pages[1].composition, applied.pages[1].composition);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  assert.deepEqual(await saved(), applied);
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page
    .getByRole("button", { name: /^Before relationship exploration/ })
    .click();
  await page
    .getByRole("region", { name: "Read-only arrangement comparison" })
    .waitFor();
  assert.equal(
    await page
      .frameLocator('iframe[title="B Desktop comparison"]')
      .locator("[contenteditable=true]")
      .count(),
    0,
  );
  await page.keyboard.press("ControlOrMeta+z");
  assert.deepEqual(await read(), applied);
  await shot("prior-study-comparison");
  await page
    .getByRole("button", { name: "Use this arrangement", exact: true })
    .click();
  const restored = await saved();
  assert.deepEqual(restored.pages[1].composition, before.pages[1].composition);
  assert.equal(restored.pages[1].intentions, undefined);
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  assert.deepEqual(await saved(), applied);
  await page.reload();
  assert.deepEqual(await saved(), applied);
  const recovery = await page.evaluate(async () => {
    const db = await (await import("/src/database.ts")).database();
    return (await db.get("documents", "pre-relationships")).value;
  });
  assert.equal(recovery.version, 12);
  assert.equal(recovery.pages[1].intentions, undefined);
  const frame = () => page.frameLocator('iframe[title$="website preview"]');
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const writing = frame().locator(
    '[data-composition-block="relationship-writing"] .direction-prose',
  );
  await writing.click();
  await writing.fill("A revised line\nkeeps its own voice.");
  await writing.press("Escape");
  const edited = await saved();
  assert.equal(
    edited.pages[1].blocks.find((b) => b.id === "relationship-writing").text,
    "A revised line\nkeeps its own voice.",
  );
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.locator(".work-picker-toggle").click();
  await page.locator('[data-work-picker="relationship-writing"]').click();
  await page
    .getByRole("button", { name: "Explore image + writing ↗", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore compositions", exact: true })
    .click();
  await page.getByText(/valid alternatives/).waitFor();
  const preview = page.frameLocator(
    'iframe[title="In conversation relationship preview"]',
  );
  await preview.locator(".direction-prose").waitFor();
  assert.equal(
    await preview.locator(".direction-prose").textContent(),
    "A revised line\nkeeps its own voice.",
  );
  await page.getByRole("button", { name: "Keep current", exact: true }).click();
  assert.deepEqual(await saved(), edited);
  const artifacts = await page.evaluate(async () => {
    const db = await (await import("/src/database.ts")).database(),
      record = await db.get("documents", "site");
    const release = await (
      await import("/src/revisions.ts")
    ).localRevisions.checkpoint(
      record.value,
      record.revision,
      "A relationship in blue",
      { expectedId: null },
    );
    const { portableHTML, portablePackage } = await import("/src/portable.ts"),
      zip = await portablePackage(release, "original");
    return {
      html: await portableHTML(release),
      zip: Array.from(new Uint8Array(await zip.blob.arrayBuffer())),
      backup: await (
        await import("/src/storage.ts")
      ).exportBackup(record.value),
    };
  });
  await writeFile(`${evidence}artist.html`, artifacts.html);
  await writeFile(`${evidence}artist.zip`, Buffer.from(artifacts.zip));
  await writeFile(`${evidence}editable-backup.json`, artifacts.backup);
  await mkdir(`${evidence}zip`, { recursive: true });
  execFileSync("/usr/bin/unzip", [
    "-o",
    `${evidence}artist.zip`,
    "-d",
    `${evidence}zip`,
  ]);
  assert.ok(!artifacts.html.includes('"intentions"'));
  const exported = await context.newPage(),
    exports = [];
  exported.on("pageerror", (e) => errors.push(e.message));
  for (const width of [390, 768, 1440])
    for (const file of ["artist.html", "zip/index.html"]) {
      await exported.setViewportSize({ width, height: 1000 });
      await exported.goto(
        `http://127.0.0.1:5181/docs/evidence/relationships/${file}?page=quiet`,
      );
      await exported.locator("img").evaluateAll(async (imgs) => {
        imgs.forEach((i) => (i.loading = "eager"));
        await Promise.all(imgs.map((i) => i.decode()));
      });
      assert.deepEqual(
        await exported
          .locator("[data-composition-block]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.compositionBlock)),
        ["relationship-image", "relationship-writing"],
      );
      assert.equal(
        await exported.locator(".direction-prose").textContent(),
        "A revised line\nkeeps its own voice.",
      );
      assert.equal(
        await exported
          .locator(
            ".relationship-explorer,.work-context,[contenteditable=true]",
          )
          .count(),
        0,
      );
      const geometry = await exported
        .locator(".composition-section")
        .evaluate((el) => ({
          boxes: [...el.querySelectorAll("[data-composition-block]")].map((n) =>
            n.getBoundingClientRect().toJSON(),
          ),
          font: el.ownerDocument.defaultView.getComputedStyle(
            el.querySelector(".direction-prose"),
          ).fontSize,
          overflow:
            el.ownerDocument.documentElement.scrollWidth >
            el.ownerDocument.defaultView.innerWidth,
        }));
      assert.equal(geometry.overflow, false);
      exports.push({ width, file, ...geometry });
      await exported.screenshot({
        path: `${evidence}export-${width}-${file.replaceAll("/", "-")}.png`,
        fullPage: true,
      });
    }
  for (const width of [390, 768, 1440]) {
    const pair = exports.filter((e) => e.width === width);
    assert.deepEqual(pair[0].boxes, pair[1].boxes);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${evidence}browser-results.json`,
    JSON.stringify(
      {
        workspace,
        browser: browser.version(),
        measurements,
        phoneMetrics,
        exports,
        errors,
        checks: [
          "three real distinct geometries per device",
          "actual metadata and source retained",
          "no live mutation before Apply",
          "placement conflict and no silent relaxation",
          "read-only preview blocks Undo",
          "touch Apply / one Undo / Redo",
          "cancel preserves draft",
          "metadata chip removal reversible",
          "study restoration and comparison guards",
          "reload and exact v12 recovery",
          "current plaintext edits reflected in new exploration",
          "frozen HTML and ZIP parity at 390/768/1440",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS full relationship workflow, recovery, original media and public exports",
  );
} catch (error) {
  await shot("failure");
  console.log(
    await page
      .locator(".relationship-explorer")
      .innerText()
      .catch(() => ""),
  );
  throw error;
} finally {
  await browser.close();
}
