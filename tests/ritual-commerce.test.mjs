import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ritualCommerce } from '../src/config/ritual-commerce.js';
import { truth } from '../src/config/truth.ts';
import { serveManagerApplication } from '../src/server/manager-application-release.js';

const page = (path) => readFile(new URL(`../src/pages/${path}.astro`, import.meta.url), 'utf8');

test('holds the exact Ritual plan contract behind the closed publication switch', () => {
  assert.equal(ritualCommerce.releaseOpen, false);
  assert.deepEqual(
    ritualCommerce.plans.map(({ id, name, priceUsd }) => ({ id, name, priceUsd })),
    [
      { id: 'monthly', name: 'Monthly', priceUsd: '14.99' },
      { id: 'annual', name: 'Annual', priceUsd: '149.99' },
      { id: 'perpetual', name: 'Yours to keep', priceUsd: '599' },
    ],
  );
  // No timed trial (2026-10-12): without a plan every photograph carries the Latent mark.
  assert.equal(ritualCommerce.markedWithoutPlan, true);
  assert.equal('trialDays' in ritualCommerce, false);
  assert.equal(
    ritualCommerce.plans.some((plan) => 'trialDays' in plan),
    false,
    'no plan carries a Paddle trial period',
  );
  assert.equal(ritualCommerce.supportedMacs, 2);
  assert.equal(ritualCommerce.manager.version, '1.1.5');
  assert.equal(ritualCommerce.manager.build, 239);
  assert.match(ritualCommerce.manager.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(truth.ritualStatus, 'Coming soon');
  assert.equal(truth.ritualPlatformStatus, 'Mac and iPad · coming soon');
});

test('keeps the customer Manager download unavailable while publication is closed', async () => {
  let touchedStorage = false;
  const response = await serveManagerApplication({
    request: new Request('https://latentstudios.art/download/manager'),
    env: { LATENT_RELEASES: { head() { touchedStorage = true; } } },
  });
  assert.equal(response.status, 404);
  assert.equal(touchedStorage, false);
});

test('serves only the pinned Manager artifact when the publication gate is opened', async () => {
  const body = new Uint8Array([1, 2, 3, 4, 5, 6]);
  const release = { ...ritualCommerce.manager, sha256: 'a'.repeat(64) };
  const storage = {
    async head(key) {
      assert.equal(key, release.key);
      return { size: body.byteLength, httpEtag: 'manager-etag' };
    },
    async get(key, options) {
      assert.equal(key, release.key);
      assert.deepEqual(options, { range: { offset: 1, length: 3 } });
      return { body: body.slice(1, 4), httpEtag: 'manager-etag' };
    },
  };
  const response = await serveManagerApplication({
    request: new Request('https://latentstudios.art/download/manager', {
      headers: { Range: 'bytes=1-3' },
    }),
    env: { LATENT_RELEASES: storage },
  }, { commerceOpen: true, release });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 1-3/6');
  assert.equal(response.headers.get('X-Latent-Release-SHA256'), 'a'.repeat(64));
  assert.equal(response.headers.get('Content-Disposition'), `attachment; filename="${release.filename}"`);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body.slice(1, 4));
});

test('purchase copy explains install-first access and the lock boundary', async () => {
  const [home, ritual, purchase] = await Promise.all([
    page('index'), page('ritual'), page('ritual/purchase'),
  ]);
  assert.match(home, /truth\.ritualPlatformStatus/u);
  assert.match(ritual, /truth\.ritualPlatformStatus/u);
  assert.match(ritual, /every tool, every stock, full-resolution exports/i);
  assert.match(ritual, /Free, with the Latent mark\./i);
  assert.match(ritual, /the mark returns/i);
  assert.match(purchase, /Free, with the Latent mark/i);
  assert.match(purchase, /no payment method/i);
  assert.match(purchase, /carry the Latent mark again/i);
  for (const page of [ritual, purchase]) {
    assert.doesNotMatch(page, /fourteen|view-only/i, 'the timed trial and view-only library are retired');
  }
  assert.match(purchase, /original files can always be revealed or copied out/i);
  assert.match(purchase, /yours forever, with every update to that version free/i);
  assert.match(purchase, /Paddle handles the secure checkout/i);
  assert.match(purchase, /There is no license key to copy/i);
});
