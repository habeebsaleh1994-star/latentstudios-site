const { chromium } = await import(
  process.env.LATENT_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const evidence = fileURLToPath(
  new URL("../docs/evidence/spatial-sections/migration/", import.meta.url),
);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext(),
  errors = [],
  results = [];
try {
  const loaders = [];
  for (const port of [5193, 5181]) {
    const page = await context.newPage(),
      workspace = randomUUID();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/?studio=${workspace}&page=quiet`);
    await page.evaluate(async (workspace) => {
      const { activeWorkspaceId } = await import("/src/workspace.ts");
      if (activeWorkspaceId !== workspace)
        throw Error("Refuse non-test workspace");
      if (
        await (
          await (await import("/src/database.ts")).database()
        ).get("documents", "site")
      )
        throw Error("Refuse existing draft");
    }, workspace);
    loaders.push(page);
  }
  const legacy = await loaders[0].evaluate(async () => {
    const { initialSite, blankBlock, migrateComposition } = await import(
      "/src/model.ts"
    );
    const site = structuredClone(initialSite),
      p = site.pages[1];
    site.name = "Mira Vale";
    p.title = "Intervals";
    p.subtitle = "Synthetic migration proof";
    p.blocks = ["a", "b", "c", "d"].map((id, i) => ({
      ...blankBlock(i === 1 ? "text" : "image"),
      id,
      text:
        i === 1
          ? "A colour becomes a place when you stay with it long enough."
          : "",
      assetId: i === 1 ? "" : ["formBlue", "", "formRed", "formYellow"][i],
      caption: `Study ${id}`,
      alt: "Synthetic geometric study",
      fit: i % 2 ? "portrait" : "landscape",
      focal: { x: 23, y: 72 },
    }));
    p.composition = {
      enabled: true,
      sections: [
        {
          id: "pair",
          blockIds: ["a", "b"],
          layout: "emphasis-right",
          width: "wide",
          align: "right",
          vertical: "end",
          gap: 44,
          space: 100,
          mobile: {
            layout: "columns",
            width: "inset",
            gap: 12,
            space: 36,
            reverse: true,
          },
        },
        {
          id: "last",
          blockIds: ["c", "d"],
          layout: "stack",
          width: "reading",
          align: "left",
          vertical: "center",
          gap: 20,
          space: 64,
          mobile: {
            layout: "stack",
            width: "full",
            gap: 40,
            space: 80,
            reverse: true,
          },
        },
      ],
      mobileOrder: ["last", "pair"],
    };
    p.composition = migrateComposition(p.composition);
    site.pages = [site.pages[0], p];
    return site;
  });
  const rendered = await context.newPage();
  rendered.on("pageerror", (e) => errors.push(e.message));
  let html = "";
  await rendered.route("**/__migration-proof.html*", (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: html }),
  );
  for (const enabled of [true, false])
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
    ]) {
      const input = structuredClone(legacy);
      input.styleId = style;
      input.pages[1].composition.enabled = enabled;
      const exports = [];
      for (const loader of loaders)
        exports.push(
          await loader.evaluate(async (site) => {
            const { collectMedia } = await import("/src/revisions.ts"),
              { portableHTML } = await import("/src/portable.ts");
            return portableHTML({
              format: "latent-studio-revision",
              version: 1,
              id: "migration-reference",
              name: "Reference",
              createdAt: "",
              sourceRevision: 1,
              site,
              ...(await collectMedia(site)),
            });
          }, input),
        );
      for (const width of [390, 1440]) {
        const images = [],
          geometry = [];
        await rendered.setViewportSize({ width, height: 1000 });
        for (let i = 0; i < 2; i++) {
          html = exports[i];
          await rendered.goto(
            "http://127.0.0.1:5181/__migration-proof.html?page=quiet",
          );
          await rendered.locator(".artist-site").waitFor();
          await rendered.evaluate(async () => {
            await globalThis.document.fonts.ready;
            await Promise.all(
              [...globalThis.document.images].map((im) =>
                im.decode().catch(() => {}),
              ),
            );
            await new Promise((r) =>
              globalThis.requestAnimationFrame(() =>
                globalThis.requestAnimationFrame(r),
              ),
            );
          });
          geometry.push(
            await rendered
              .locator("[data-composition-block]")
              .evaluateAll((els) =>
                els.map((el) => ({
                  id: el.dataset.compositionBlock,
                  rect: el.getBoundingClientRect().toJSON(),
                  text: el.textContent,
                })),
              ),
          );
          images.push(await rendered.screenshot({ fullPage: true }));
        }
        assert.deepEqual(
          geometry[1],
          geometry[0],
          `${style} ${enabled} ${width} geometry`,
        );
        const hashes = images.map((bytes) =>
          createHash("sha256").update(bytes).digest("hex"),
        );
        assert.equal(
          hashes[1],
          hashes[0],
          `${style} ${enabled} ${width} pixels`,
        );
        results.push({
          style,
          enabled,
          width,
          identicalPixels: true,
          hash: hashes[0],
        });
        if (style === "gallery" && enabled) {
          await writeFile(evidence + `v10-${width}.png`, images[0]);
          await writeFile(evidence + `v11-${width}.png`, images[1]);
        }
        console.log(
          "PASS",
          style,
          enabled ? "arranged" : "original",
          width,
          "identical pixels",
        );
      }
    }
  assert.deepEqual(errors, []);
  await writeFile(
    evidence + "browser-results.json",
    JSON.stringify(
      {
        browser: browser.version(),
        baseline: "Archived v0.15.0 source served temporarily on 5193",
        results,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
