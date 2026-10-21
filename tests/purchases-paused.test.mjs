import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { purchases, pausedFreeLine } from '../src/config/purchases.js';

const page = (path) => readFileSync(new URL(`../src/pages/${path}`, import.meta.url), 'utf8');

test('the paused note names no provider and promises nothing it cannot keep', () => {
  for (const line of [purchases.label, purchases.line, purchases.ask, purchases.done]) {
    assert.doesNotMatch(line, /paddle|fastspring|free\b/i);
  }
  assert.equal(pausedFreeLine('The Ritual'), 'The Ritual is free to use with the Latent mark in the meantime.');
});

test('every page where a plan is chosen carries the note, each with its own product list', () => {
  assert.match(page('ritual.astro'), /<PurchasesPaused product="ritual" id="plans-back-ritual" \/>/);
  assert.match(page('ritual/purchase.astro'), /<PurchasesPaused product="ritual" id="plans-back-purchase" \/>/);
  assert.match(page('lab.astro'), /<PurchasesPaused product="lab" id="plans-back-lab" \/>/);
});

test('while paused, /lab does not advertise a code to use at a checkout that cannot open', () => {
  assert.match(page('lab.astro'), /labSaleOn && !purchases\.paused/);
});
