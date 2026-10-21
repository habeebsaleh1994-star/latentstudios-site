import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { firmware, firmwareAmount, firmwareDestination } from '../src/config/firmware.js';

test('the firmware is released (21 Oct 2026): a $0 choice downloads from the site\'s own download page', () => {
  assert.equal(firmware.released, true);
  assert.equal(firmware.downloadHref, '/firmware/download');
  assert.equal(firmwareDestination(0), '/firmware/download');
});

test('pay what you want: $0, or whole dollars from $5 to $100', () => {
  assert.deepEqual(firmware.amounts, [0, 10, 25, 50, 100]);
  assert.equal(firmwareAmount('25'), 25);
  assert.equal(firmwareAmount(' 7 '), 7);
  assert.equal(firmwareAmount(5), 5);
  assert.equal(firmwareAmount(1), null);
  assert.equal(firmwareAmount('4'), null);
  assert.equal(firmwareAmount(0), 0);
  for (const bad of ['101', '2.5', '-1', 'ten', '', null, 1e9]) assert.equal(firmwareAmount(bad), null, String(bad));
});

test('$0 is the plain download; any other amount is Paddle at that amount, on the licensing service', () => {
  const config = { checkoutOrigin: 'https://license.latentstudios.art', downloadHref: '/download/firmware' };
  assert.equal(firmwareDestination(0, config), '/download/firmware');
  assert.equal(firmwareDestination(25, config), 'https://license.latentstudios.art/firmware?amount=25');
  assert.equal(firmwareDestination(100, config), 'https://license.latentstudios.art/firmware?amount=100');
  assert.equal(firmwareDestination(101, config), null);
});

test('the page keeps "get notified" until release, and never words payment as a donation', async () => {
  const page = await readFile(new URL('../src/pages/firmware.astro', import.meta.url), 'utf8');
  assert.match(page, /const released = firmware\.released && Boolean\(firmware\.downloadHref\);/u);
  assert.match(page, /list" value="firmware"/u);
  assert.doesNotMatch(page, /donat|crowdfund|pledge/iu);
});

test('the first release lists four downloads, served only once released, byte for byte', async () => {
  const { firmwareDownloads } = await import('../src/config/firmware.js');
  const { serveFirmwareFile } = await import('../src/server/firmware-release.js');
  assert.equal(firmwareDownloads.length, 4);
  for (const file of firmwareDownloads) assert.match(file.key, /^firmware\/the-ritual-5d\/1\.0\//u);
  const bucket = { head: async () => ({ size: 3567631531 }), get: async (_k, o) => ({ body: 'x', range: o }) };
  const req = (h = {}) => new Request('https://latentstudios.art/download/firmware/mark-ii-mac', { headers: h });
  const ctx = (h) => ({ request: req(h), env: { LATENT_RELEASES: bucket } });
  assert.equal((await serveFirmwareFile(ctx(), 'mark-ii-mac', { released: false })).status, 404);
  assert.equal((await serveFirmwareFile(ctx(), 'nope', { released: true })).status, 404);
  const full = await serveFirmwareFile(ctx(), 'mark-ii-mac', { released: true });
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('Content-Length'), '3567631531');
  assert.match(full.headers.get('Content-Disposition'), /Ritual-for-5D-Mark-II-1\.0\.dmg/u);
  const part = await serveFirmwareFile(ctx({ Range: 'bytes=100-199' }), 'mark-ii-mac', { released: true });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 100-199/3567631531');
});

test('a download counts once when it starts, and once more only when its last byte is handed over', async () => {
  const { serveFirmwareFile } = await import('../src/server/firmware-release.js');
  const size = 3567532901; // the 5D Mac file; the fake bucket streams a few small pieces in its place
  const counted = [];
  const db = { prepare: () => ({ bind: (_day, product) => ({ run: async () => { counted.push(product); } }) }) };
  const stream = (n) => new ReadableStream({
    start(c) { for (let i = 0; i < n; i += 100) c.enqueue(new Uint8Array(Math.min(100, n - i))); c.close(); },
  });
  const bucket = { head: async () => ({ size }), get: async () => ({ body: stream(300) }) };
  const run = async (headers, read) => {
    counted.length = 0;
    const waits = [];
    const ctx = {
      request: new Request('https://latentstudios.art/download/firmware/classic-mac', { headers }),
      env: { LATENT_RELEASES: bucket, DOWNLOAD_COUNTS: db },
      waitUntil: (p) => waits.push(p),
    };
    const res = await serveFirmwareFile(ctx, 'classic-mac', { released: true });
    if (read === 'all') await res.arrayBuffer();
    else if (read === 'cancel') { const r = res.body.getReader(); await r.read(); await r.cancel(); }
    await Promise.all(waits);
    await new Promise((r) => setTimeout(r, 0));
    return [...counted];
  };
  assert.deepEqual(await run({}, 'all'), ['the-ritual-5d/classic-mac', 'the-ritual-5d/classic-mac/finished']);
  assert.deepEqual(await run({}, 'cancel'), ['the-ritual-5d/classic-mac']);
  assert.deepEqual(await run({ Range: `bytes=${size - 600}-` }, 'all'), ['the-ritual-5d/classic-mac/finished']);
  assert.deepEqual(await run({ Range: 'bytes=0-499' }, 'all'), ['the-ritual-5d/classic-mac']);
  assert.deepEqual(await run({ Range: 'bytes=200-499' }, 'all'), []);
});
