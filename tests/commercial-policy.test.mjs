import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (name) => readFile(new URL(`../src/pages/${name}.astro`, import.meta.url), 'utf8');

test('privacy policy names the Manager account and licensing data boundary', async () => {
  const privacy = await source('privacy');

  assert.doesNotMatch(privacy, /only information we ask for is your email address/i);
  assert.match(privacy, /sign in with Google or Apple/i);
  assert.match(privacy, /do not receive or store your Google or Apple password/i);
  assert.match(privacy, /provider email address as a hidden account-merging key/i);
  assert.match(privacy, /session token is kept in your Mac&rsquo;s Keychain/i);
  assert.match(privacy, /installation public key and fingerprint/i);
  assert.match(privacy, /never receives your photographs, footage, project files, or payment card details/i);
  assert.match(privacy, /support@latentstudios\.art/i);
});

test('commercial terms match the release licensing contract', async () => {
  const [terms, refund] = await Promise.all([source('terms'), source('refund')]);

  assert.match(terms, /up to two Mac computers/i);
  assert.match(terms, /free seven-day trial and requires a payment method/i);
  assert.match(terms, /renews each year until you cancel/i);
  assert.match(terms, /perpetual plan is a single, non-recurring payment/i);
  assert.match(terms, /does not upload your photographs, footage, or Resolve projects/i);
  assert.match(refund, /30 days from the date of purchase/i);
  assert.match(refund, /support@latentstudios\.art/i);
});

test('Print Engine storefront opens the Manager-owned production sale path', async () => {
  const [lab, checkout] = await Promise.all([source('lab'), source('checkout')]);

  for (const page of [lab, checkout]) {
    assert.match(page, /Paddle/i);
    assert.match(page, /up to two Macs/i);
    assert.match(page, /There is no (license )?key/i);
  }
  assert.match(lab, /labCommerce\.yearlyUsd/);
  assert.match(lab, /labCommerce\.lifetimeUsd/);
  assert.match(lab, /labCommerce\.trialDays/);
  assert.match(checkout, /\$199/i);
  assert.match(checkout, /\$499/i);
  assert.match(checkout, /seven-day trial/i);
  assert.match(lab, /DaVinci Resolve Studio/i);
  assert.match(lab, /film assets download separately in Latent Manager/i);
  assert.doesNotMatch(lab, /Not for sale yet|Request clean beta access/i);
  assert.doesNotMatch(checkout, /Web purchases are not open yet/i);
});
