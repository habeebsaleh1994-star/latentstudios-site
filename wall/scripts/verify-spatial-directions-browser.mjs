const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence = fileURLToPath(
  new URL("../docs/evidence/spatial-sections/", import.meta.url),
);
const original = await readFile(evidence + "spatial-artist.html", "utf8"),
  tag = original.match(
    /<script id="latent-document" type="application\/json">([\s\S]*?)<\/script>/,
  ),
  base = JSON.parse(tag[1]);
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ reducedMotion: "reduce" }),
  page = await context.newPage(),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
let html = "";
await page.route("**/__spatial-directions.html*", (route) =>
  route.fulfill({ status: 200, contentType: "text/html", body: html }),
);
const make = (d) =>
  original.replace(
    tag[0],
    `<script id="latent-document" type="application/json">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`,
  );
try {
  for (const style of [
    "folio",
    "gallery",
    "cinema",
    "archive",
    "gazette",
    "horizon",
    "poster",
    "atelier",
    "journal",
    "montage",
  ])
    for (const kind of ["project", "writing", "about"])
      for (const width of [390, 768, 1440]) {
        const data = structuredClone(base),
          p = data.site.pages[1];
        data.site.styleId = style;
        p.kind = kind;
        p.composition.mobile[0].spatial.enabled = true;
        html = make(data);
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(
          "http://127.0.0.1:5181/__spatial-directions.html?page=quiet",
        );
        await page.locator(".spatial-stage").waitFor();
        await page.locator("img").evaluateAll(async (imgs) => {
          imgs.forEach((im) => (im.loading = "eager"));
          await Promise.all(imgs.map((im) => im.decode()));
        });
        await page.locator("video").evaluateAll(async (videos) =>
          Promise.all(
            videos.map((v) =>
              v.readyState >= 1
                ? Promise.resolve()
                : new Promise((resolve, reject) => {
                    v.addEventListener("loadedmetadata", resolve, {
                      once: true,
                    });
                    setTimeout(() => reject(Error("Film unavailable")), 5000);
                  }),
            ),
          ),
        );
        const mobile = width === 390,
          sections = mobile ? p.composition.mobile : p.composition.desktop;
        const order = await page
          .locator("[data-composition-block]")
          .evaluateAll((els) => els.map((el) => el.dataset.compositionBlock));
        assert.deepEqual(
          order,
          sections.flatMap((s) => s.blockIds),
        );
        for (const s of sections.filter((s) => s.spatial?.enabled)) {
          const actual = await page
            .locator(`[data-spatial-stage="${s.id}"]`)
            .evaluate((el) => ({
              r: el.getBoundingClientRect().toJSON(),
              items: [
                ...el.querySelectorAll(":scope > [data-composition-block]"),
              ].map((w) => ({
                id: w.dataset.compositionBlock,
                r: w.getBoundingClientRect().toJSON(),
                z: globalThis.getComputedStyle(w).zIndex,
              })),
            }));
          for (const f of s.spatial.frames) {
            const w = actual.items.find((w) => w.id === f.blockId);
            assert.ok(
              Math.abs(
                ((w.r.left - actual.r.left) * 100) / actual.r.width - f.x,
              ) < 0.025,
            );
            assert.ok(
              Math.abs((w.r.width * 100) / actual.r.width - f.width) < 0.025,
            );
            assert.ok(Math.abs(w.r.top - actual.r.top - f.y) < 0.1);
            assert.ok(w.r.bottom <= actual.r.bottom + 0.1);
            assert.equal(Number(w.z), s.spatial.layers.indexOf(f.blockId) + 1);
          }
        }
        assert.ok(
          await page.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth + 1,
          ),
          `${style}/${kind}/${width} overflow`,
        );
        results.push({
          style,
          kind,
          width,
          readingOrder: order,
          spatialPhone: mobile,
        });
        if (
          kind === "project" &&
          ["poster", "cinema", "gallery"].includes(style)
        )
          await page.screenshot({
            path: evidence + `${style}-spatial-${width}.png`,
            fullPage: true,
          });
        console.log("PASS", style, kind, width);
      }
  // Render very long unbroken text with large phone type: intrinsic containment must not depend on editor measurement.
  const stress = structuredClone(base);
  stress.site.pages[1].composition.mobile = structuredClone(
    stress.site.pages[1].composition.desktop,
  ).map((s) => ({
    ...s,
    id: "phone-stress",
    layout: "columns",
    width: "full",
    gap: 24,
    space: 48,
  }));
  const p = stress.site.pages[1];
  p.blocks.find((b) => b.id === "verse").text =
    "Unbroken".repeat(160) + "\n\n  Last line";
  p.blocks.find((b) => b.id === "verse").typography.mobile = {
    size: 32,
    leading: 2,
    measure: 18,
  };
  html = make(stress);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5181/__spatial-directions.html?page=quiet");
  await page.locator(".spatial-stage").waitFor();
  const measured = await page.locator(".spatial-stage").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      height: r.height,
      width: r.width,
      contained: [
        ...el.querySelectorAll(":scope > [data-composition-block]"),
      ].every((w) => {
        const b = w.getBoundingClientRect();
        return b.bottom <= r.bottom + 0.1 && b.right <= r.right + 0.1;
      }),
    };
  });
  assert.ok(measured.contained);
  assert.ok(measured.height > 3000);
  assert.deepEqual(errors, []);
  await writeFile(
    evidence + "directions-browser-results.json",
    JSON.stringify(
      { browser: browser.version(), results, stress: measured, errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
