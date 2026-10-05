const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import { seedCanvasFixture } from "./canvas-fixture.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence = fileURLToPath(
  new URL(
    "../docs/evidence/selection-readability/plaintext-regression/",
    import.meta.url,
  ),
);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage(),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const workspace = await seedCanvasFixture(page);
  const frame = () => page.frameLocator('iframe[title$="website preview"]');
  const text = () => frame().locator('[data-text-work="note"]');
  const source = async () => {
    await page.getByText("Saved on this device", { exact: true }).waitFor();
    await page.waitForTimeout(160);
    return page.evaluate(async () => {
      const s = (
        await (
          await (await import("/src/database.ts")).database()
        ).get("documents", "site")
      ).value;
      return s.pages.flatMap((p) => p.blocks).find((b) => b.id === "note").text;
    });
  };
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  for (const [keys, expected] of [
    [["Enter", "b"], "a\nb"],
    [["Enter", "Enter", "b"], "a\n\nb"],
    [["Enter", "Enter", "Enter", "b"], "a\n\n\nb"],
    [["Shift+Enter", "b"], "a\nb"],
    [["Enter"], "a\n"],
    [["Enter", "Enter"], "a\n\n"],
  ]) {
    await text().click();
    await text().fill("a");
    await text().press("ControlOrMeta+End");
    for (const key of keys) await text().press(key);
    const actual = await source();
    assert.equal(actual, expected, `native keys ${keys}`);
    assert.equal(await text().textContent(), expected);
    await text().press("Escape");
    results.push(
      `Native ${keys.join(" ")} retains ${JSON.stringify(expected)}`,
    );
  }
  await text().click();
  await text().fill("abcd");
  await text().press("ArrowLeft");
  await text().press("ArrowLeft");
  assert.equal(
    await text().evaluate((el) => el.ownerDocument.getSelection().focusOffset),
    2,
  );
  await text().press("Enter");
  await text().press("x");
  assert.equal(
    await source(),
    "ab\nxcd",
    "caret remains at inserted line in the middle of text",
  );
  await text().press("Backspace");
  await text().press("Backspace");
  assert.equal(await source(), "abcd", "backspace joins exact source lines");
  await text().press("Escape");
  for (const original of ["\na\n", "a\n\n\nb", "lower case\n  space\n\n", ""]) {
    await text().click();
    await text().fill(original);
    await text().press("Escape");
    assert.equal(
      await source(),
      original,
      "repeated replacement preserves deliberate boundaries",
    );
    await page.reload();
    assert.equal(
      await source(),
      original,
      "reload preserves deliberate boundaries",
    );
  }
  await text().click();
  await text().fill("abcd");
  await text().press("Shift+ArrowLeft");
  await text().press("Shift+ArrowLeft");
  await text().press("Enter");
  await text().press("x");
  assert.equal(
    await source(),
    "ab\nx",
    "Enter replaces only the selected text",
  );
  await text().press("ControlOrMeta+a");
  await text().press("Backspace");
  assert.equal(
    await source(),
    "",
    "native select-all deletion leaves no phantom newline",
  );
  await text().fill("Undo anchor");
  await text().press("Escape");
  await source();
  await text().click();
  await text().press("ArrowRight");
  await text().press("ControlOrMeta+ArrowRight");
  await text().press("Enter");
  await text().press("b");
  await text().press("Escape");
  await source();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(
    await source(),
    "Undo anchor",
    "one document Undo restores the interrupted writing session",
  );
  await page.reload();
  assert.equal(await source(), "Undo anchor");
  results.push(
    "Native selected replacement, select-all deletion and document Undo preserve exact source after reload.",
  );
  assert.deepEqual(errors, []);
  results.push(
    "Middle-of-line Enter retains caret, Backspace rejoins lines, repeated replacements and reload preserve leading/trailing blank lines and spaces.",
  );
  await writeFile(
    evidence + "plaintext-browser-results.json",
    JSON.stringify(
      { browser: browser.version(), workspace, results, errors },
      null,
      2,
    ),
  );
  console.log(results.map((s) => "PASS " + s).join("\n"));
} catch (e) {
  await page.screenshot({ path: evidence + "plaintext-failure.png" });
  throw e;
} finally {
  await browser.close();
}
