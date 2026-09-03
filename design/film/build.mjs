// Builds the film two ways:
//   node build.mjs inline          -> film-artifact.html (assets embedded, for the shareable page)
//   node build.mjs frames 2 9 17   -> sample frames as PNG into out/frames-sample
//   node build.mjs video           -> out/latent-studios.mp4 (1920x1080, 30 fps) via headless Chromium + ffmpeg
// Uses the Playwright Chromium already on this machine (via the versos project's node_modules).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const here = path.dirname(new URL(import.meta.url).pathname);
const mode = process.argv[2] ?? 'inline';
const require = createRequire('/private/tmp/claude-501/-Users-habibsaleh-Documents-Salon/a2b7997d-e9d9-4004-868f-24128bae1e01/scratchpad/pdf/package.json');

function inlineHtml() {
  let html = fs.readFileSync(path.join(here, 'film.html'), 'utf8');
  for (const name of ['before', 'after', 'after2', 'lab']) {
    const b64 = fs.readFileSync(path.join(here, 'assets', `${name}.jpg`)).toString('base64');
    html = html.replace(`'assets/${name}.jpg'`, `'data:image/jpeg;base64,${b64}'`);
  }
  // A full document with the images embedded, for rendering (file:// images taint the canvas).
  fs.writeFileSync(path.join(here, 'film-inline.html'), html);
  // The artifact wants page content only: drop the document wrapper.
  const inner = html
    .replace(/^[\s\S]*?<title>/, '<title>')
    .replace('</head>\n<body>', '')
    .replace(/<\/body>\s*<\/html>\s*$/, '');
  fs.writeFileSync(path.join(here, 'film-artifact.html'), inner);
  console.log('wrote film-artifact.html', (inner.length / 1024).toFixed(0), 'KB');
}

async function openFilm() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  inlineHtml();
  await page.goto('file://' + path.join(here, 'film-inline.html') + '?render=1');
  await page.waitForFunction(() => window.__film !== undefined, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  return { browser, page };
}

async function frames(times) {
  const out = path.join(here, 'out', 'frames-sample');
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await openFilm();
  for (const t of times) {
    await page.evaluate((tt) => window.__film.setTime(tt), t);
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(out, `t${String(t).padStart(5, '0')}.png`) });
    console.log('frame', t);
  }
  await browser.close();
}

async function video() {
  const fps = 30;
  const dir = path.join(here, 'out', 'frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { browser, page } = await openFilm();
  const duration = await page.evaluate(() => window.__film.duration);
  const n = Math.round(duration * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((tt) => window.__film.setTime(tt), i / fps);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, '0')}.png`) });
    if (i % 150 === 0) console.log(`${i}/${n}`);
  }
  await browser.close();
  const mp4 = path.join(here, 'out', 'latent-studios.mp4');
  execSync(`ffmpeg -y -framerate ${fps} -i "${dir}/f%05d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart "${mp4}"`, { stdio: 'inherit' });
  console.log('wrote', mp4);
}

if (mode === 'inline') inlineHtml();
else if (mode === 'frames') await frames(process.argv.slice(3).map(Number));
else if (mode === 'video') await video();
