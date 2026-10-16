import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { firmware, firmwareAmount, firmwareDestination } from '../src/config/firmware.js';

test('the firmware is not released: no checkout and no download until release day', () => {
  assert.equal(firmware.released, false);
  assert.equal(firmware.downloadHref, null);
});

test('pay what you want: whole dollars from $0 to $100', () => {
  assert.deepEqual(firmware.amounts, [0, 10, 25, 50, 100]);
  assert.equal(firmwareAmount('25'), 25);
  assert.equal(firmwareAmount(' 7 '), 7);
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
