import { chromium } from "/Users/habibsaleh/Documents/latentstudios-site/wall/node_modules/playwright-core/index.mjs";
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
await pg.goto("file://" + process.argv[2]); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(300);
await pg.screenshot({ path: process.argv[3], type: "png" }); await b.close(); console.log("card");
