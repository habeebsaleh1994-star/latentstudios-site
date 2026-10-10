import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

// Paid ads depend on these URLs even though they are absent from navigation
// and search. Check the output that will ship, so a successful build cannot
// silently omit a landing page or an image again.
const output = new URL('../dist/', import.meta.url);
const routes = ['moment/get/', 'moment/get/b/', 'moment/get/c/', 'moment/get/films/'];
const sitemap = await readFile(new URL('sitemap-0.xml', output), 'utf8');

for (const route of routes) {
  const html = await readFile(new URL(`${route}index.html`, output), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex"\s*\/?>/, `${route}: missing noindex`);
  assert.match(html, /href="https:\/\/apps\.apple\.com\/app\/id6786220649\?ppid=c67eec6a-48f0-41b6-946c-9b3e60a20f37"/, `${route}: missing ad's App Store destination`);
  assert.ok(!sitemap.includes(`https://latentstudios.art/${route}`), `${route}: ad page leaked into sitemap`);

  const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
  const photos = images.filter((src) => src.startsWith('/moment/get/'));
  assert.equal(photos.length, route.endsWith('/films/') ? 10 : 1, `${route}: missing ad photographs`);
  assert.ok(images.some((src) => src.startsWith('/moment/app-store-badge-white.svg')), `${route}: missing download badge`);

  for (const src of images) {
    const path = new URL(src, 'https://latentstudios.art').pathname;
    const asset = await stat(new URL(`.${path}`, output));
    assert.ok(asset.isFile() && asset.size > 0, `${route}: missing image ${path}`);
  }
}

console.log(`Verified ${routes.length} ad landing pages, their photographs, download links, and search exclusions.`);
