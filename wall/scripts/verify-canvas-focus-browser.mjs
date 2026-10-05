const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import { seedCanvasFixture } from "./canvas-fixture.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence =
  process.env.LATENT_EVIDENCE_DIRECTORY ||
  fileURLToPath(
    new URL(
      "../docs/evidence/selection-readability/focus-regression/",
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
  measurements = [];
page.on("pageerror", (e) => errors.push(e.message));
const note = (s) => {
  console.log("PASS", s);
  results.push(s);
};
try {
  const workspace = await seedCanvasFixture(page);
  const frame = () => page.frameLocator('iframe[title$="website preview"]');
  const a = () => page.frameLocator('iframe[title^="A "]'),
    b = () => page.frameLocator('iframe[title^="B "]');
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
    await page.waitForTimeout(160);
    return read();
  };
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await frame().locator('[data-work-choice="blue"]').click();
  await frame().locator('[data-work-choice="note"]').click();
  const baseline = await wait();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .getByRole("button", {
        name: width < 700 ? "Mobile preview" : "Desktop preview",
        exact: true,
      })
      .click();
    await page.waitForTimeout(180);
    const normal = await page.locator(".preview-stage").boundingBox();
    await page.screenshot({ path: evidence + `after-${width}.png` });
    await page
      .getByRole("button", { name: "Focus canvas", exact: true })
      .click();
    await page.waitForTimeout(150);
    const focus = await page.locator(".preview-stage").boundingBox();
    measurements.push({
      width,
      normal,
      focus,
      paper: await page.locator(".preview-paper").boundingBox(),
    });
    assert.ok(focus.height > 600, `focus height ${width}: ${focus.height}`);
    assert.ok(focus.y < 200, `focus top ${width}: ${focus.y}`);
    await frame().locator('[data-work-choice="note"]').scrollIntoViewIfNeeded();
    const boxes = await frame()
      .locator(".composition-sequence")
      .evaluate((root) => ({
        controls: [
          ...root.querySelectorAll("[data-work-choice],[data-work-drag]"),
        ].map((el) => ({
          id: el.dataset.workChoice || el.dataset.workDrag,
          r: el.getBoundingClientRect().toJSON(),
        })),
        works: [...root.querySelectorAll(".composition-work")].map((el) => ({
          id: el.dataset.compositionBlock,
          r: el.getBoundingClientRect().toJSON(),
        })),
      }));
    for (const control of boxes.controls) {
      const work = boxes.works.find((w) => w.id === control.id);
      assert.ok(
        control.r.bottom <= work.r.top + 1,
        "controls must be above artwork",
      );
    }
    const physical = await frame()
      .locator('[data-work-choice="note"]')
      .boundingBox();
    assert.ok(physical.height >= 43.5 && physical.width >= 43.5);
    assert.ok(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth + 1,
      ),
    );
    await page.screenshot({ path: evidence + `focus-${width}.png` });
    await page
      .getByRole("button", { name: "Exit canvas focus", exact: true })
      .click();
  }
  assert.deepEqual(await wait(), baseline);
  note(
    "Focus, device changes, and inspector collapse improve measured canvas space without changing the saved document; 44px controls sit above artwork.",
  );
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  assert.equal(
    await frame()
      .locator("body")
      .evaluate((el) => el.ownerDocument.defaultView.innerWidth),
    1024,
  );
  assert.equal(
    await page
      .locator(".preview-paper iframe")
      .evaluate((el) => globalThis.getComputedStyle(el).transform),
    "none",
  );
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  assert.notEqual(
    await page
      .locator(".preview-paper iframe")
      .evaluate((el) => globalThis.getComputedStyle(el).transform),
    "none",
  );
  note(
    "Fit and 100% preserve a 1024px desktop viewport; actual size removes scaling and allows horizontal inspection.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  for (const id of ["blue", "red"]) {
    const caption = frame().locator(
      `[data-composition-block="${id}"] figcaption .editable-copy`,
    );
    await caption.click();
    await caption.fill(`${id} · Current caption`);
    await caption.press("Escape");
    await wait();
  }
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await wait();
  assert.equal(
    await page.getByRole("button", { name: "Undo", exact: true }).isEnabled(),
    true,
  );
  assert.equal(
    await page.getByRole("button", { name: "Redo", exact: true }).isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.getByRole("button", { name: /^Quiet reading/ }).click();
  await page
    .getByRole("region", { name: "Read-only arrangement comparison" })
    .waitFor();
  await a().locator('[data-composition-block="blue"]').waitFor();
  await b().locator('[data-composition-block="blue"]').waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(),
    true,
  );
  assert.equal(await page.locator(".editor-sidebar").isVisible(), false);
  for (const pane of [a(), b()]) {
    assert.equal(
      await pane
        .locator(
          '[contenteditable="plaintext-only"],[data-work-choice],[data-canvas-action]',
        )
        .count(),
      0,
    );
  }
  assert.equal(
    await a()
      .locator("body")
      .evaluate((el) => el.ownerDocument.defaultView.innerWidth),
    await b()
      .locator("body")
      .evaluate((el) => el.ownerDocument.defaultView.innerWidth),
  );
  await page.screenshot({ path: evidence + "comparison-desktop.png" });
  const before = await read();
  await page
    .locator(".editor-sidebar textarea")
    .first()
    .evaluate((el) => {
      Object.getOwnPropertyDescriptor(
        globalThis.HTMLTextAreaElement.prototype,
        "value",
      ).set.call(el, "Blocked hidden edit");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await page
    .locator(".editor-sidebar .row-reorder button")
    .last()
    .evaluate((el) => el.click());
  assert.deepEqual(await wait(), before);
  await page.keyboard.press("Meta+z");
  await page.keyboard.press("Control+y");
  await a().locator("body").press("Meta+z");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "synthetic.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
      ),
    });
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles({
      name: "synthetic.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await page.waitForTimeout(220);
  assert.deepEqual(await read(), before);
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page.evaluate(async () =>
      (await (await import("/src/database.ts")).database()).count("assets"),
    ),
    0,
  );
  await page.getByRole("button", { name: /Composition studies/ }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Keep study", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Remove study Quiet reading", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: /Composition studies/ }).click();
  note(
    "Reproduced v0.12 hidden-sidebar leak is closed: comparison blocks hidden input/reorder events, Undo/Redo in both windows, study mutations and late upload/restore callbacks; no asset writes.",
  );
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  await page
    .locator(".comparison-paper")
    .first()
    .evaluate((el) => {
      el.scrollLeft = 160;
    });
  await page.waitForTimeout(120);
  assert.equal(
    await page
      .locator(".comparison-paper")
      .last()
      .evaluate((el) => el.scrollLeft),
    160,
  );
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  const at = async (pane) =>
    pane
      .locator("body")
      .evaluate(async (el) =>
        (await import("/src/previewPosition.ts")).readPreviewPosition(
          el.ownerDocument,
        ),
      );
  await a()
    .locator('[data-composition-block="red"]')
    .evaluate((el) => {
      const w = el.ownerDocument.defaultView,
        r = el.getBoundingClientRect();
      w.scrollTo(0, w.scrollY + r.top + r.height * 0.12);
    });
  await page.waitForTimeout(250);
  const posA = await at(a()),
    posB = await at(b());
  assert.equal(posB.blockId, posA.blockId);
  assert.ok(
    Math.abs(posA.fraction - posB.fraction) < 0.04,
    JSON.stringify({ posA, posB }),
  );
  await page.screenshot({ path: evidence + "comparison-linked-position.png" });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page
    .getByRole("button", { name: "Mobile preview", exact: true })
    .click();
  await a().locator('[data-composition-block="blue"]').waitFor();
  await page.waitForTimeout(200);
  await a()
    .locator('[data-composition-block="blue"]')
    .evaluate((el) => {
      const w = el.ownerDocument.defaultView;
      w.scrollTo(0, w.scrollY + el.getBoundingClientRect().top);
    });
  await page.waitForTimeout(150);
  const narrowA = await at(a());
  await page
    .getByRole("button", { name: "B · Quiet reading", exact: true })
    .tap();
  await page.waitForTimeout(100);
  const narrowB = await at(b());
  assert.equal(narrowA.blockId, narrowB.blockId);
  assert.ok(
    Math.abs(narrowA.fraction - narrowB.fraction) < 0.04,
    JSON.stringify({ narrowA, narrowB }),
  );
  await page.screenshot({ path: evidence + "comparison-phone-b.png" });
  await page
    .getByRole("button", { name: "A · Current draft", exact: true })
    .tap();
  await page.screenshot({ path: evidence + "comparison-phone-a.png" });
  assert.deepEqual(await read(), before);
  note(
    "Desktop A/B has matched viewport scale and synchronized work-relative scroll; the narrow phone toggle retains the same reading location without writes.",
  );
  await page
    .getByRole("button", { name: "Return to draft", exact: true })
    .click();
  assert.deepEqual(await wait(), before);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await frame()
    .locator('[data-composition-block="note"] .editable-copy')
    .click();
  await page
    .getByRole("button", { name: "Show inspector", exact: true })
    .click();
  await page.getByText("Writing style", { exact: true }).waitFor();
  await page
    .getByRole("spinbutton", { name: "Text size", exact: true })
    .waitFor();
  await page.screenshot({ path: evidence + "local-writing-scope.png" });
  await page
    .getByRole("button", { name: "Hide inspector", exact: true })
    .click();
  const text = frame().locator(
    '[data-composition-block="note"] .editable-copy',
  );
  await text.fill("Current writing survives an arrangement comparison.");
  await text.press("Escape");
  const edited = await wait();
  await page.getByRole("button", { name: /Composition studies/ }).click();
  await page.getByRole("button", { name: /^Quiet reading/ }).click();
  await page
    .getByRole("button", { name: "Use this arrangement", exact: true })
    .click();
  const applied = await wait();
  assert.equal(
    applied.pages[1].blocks.find((b) => b.id === "note").text,
    "Current writing survives an arrangement comparison.",
  );
  assert.equal(applied.pages[1].composition.desktop[0].width, "reading");
  assert.ok(
    applied.pages[1].studies.some((s) => s.name === "Before Quiet reading"),
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(await wait(), edited);
  await page.reload();
  assert.deepEqual(await wait(), edited);
  note(
    "Comparison cancel is read-only; explicit apply keeps current words and the displaced arrangement, Undo restores the exact document, and reload preserves edits.",
  );
  await page.getByRole("button", { name: "Arrange", exact: true }).click();
  await frame().locator('[data-work-choice="blue"]').click();
  await frame().locator('[data-work-choice="note"]').click();
  const beforeMove = await wait(),
    grip = frame().locator('[data-work-drag="blue"]');
  await grip.press("Space");
  await grip.press("End");
  await grip.press("Escape");
  assert.deepEqual(await wait(), beforeMove);
  await grip.press("Space");
  await grip.press("End");
  await grip.press("Enter");
  await wait();
  await frame().getByRole("button", { name: "Undo move", exact: true }).click();
  assert.deepEqual(await wait(), beforeMove);
  note(
    "Movement scope is explicit in the artwork-free control rail; keyboard cancellation and contextual Undo preserve the exact draft.",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    evidence + "browser-results.json",
    JSON.stringify(
      { browser: browser.version(), workspace, measurements, results, errors },
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
