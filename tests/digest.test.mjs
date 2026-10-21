import assert from 'node:assert/strict';
import test from 'node:test';

import { composeDigest, DIGEST_FROM, previousDay, sendDigest } from '../workers/digest/src/digest.js';

const sample = {
  day: '2026-10-14',
  sendToMac: { sent: 28, opened: 14, downloads: 9 },
  sources: [{ source: 'youtube', visits: 40, downloads: 12 }],
  managerDownloads: 63,
  newAccounts: 71,
  totalAccounts: 92,
  newPlans: [{ product: 'The Ritual', plan: 'monthly', n: 3 }],
  earningsMinor: 4116,
  activePlans: [{ product: 'The Ritual', tier: 'monthly', n: 3 }],
};

test('the letter reads yesterday in numbers, and says it holds nothing of anyone', () => {
  const { subject, text, html } = composeDigest(sample);
  assert.equal(subject, 'Yesterday at Latent · 71 new accounts · 3 sales · $41.16');
  assert.match(text, /^Wednesday 14 October \(UTC\)$/mu);
  assert.match(text, /^Send to Mac: 28 sent · 14 opened \(50\.0%\) · 9 downloaded Manager$/mu);
  assert.match(text, /^New plans: 3 \(3 The Ritual monthly\)$/mu);
  assert.match(text, /^youtube: 40 visits · 12 downloads$/mu);
  assert.match(text, /^Accounts: 92 · paying: 3 \(3\.3%\)$/mu);
  assert.match(text, /Numbers only/u);
  assert.match(html, /Send to Mac: 28 sent/u);
});

test('a quiet day still writes, without dividing by nothing', () => {
  const { subject, text } = composeDigest({ ...sample, sendToMac: { sent: 0, opened: 0, downloads: 0 }, sources: [],
    newAccounts: 1, newPlans: [], earningsMinor: 0 });
  assert.equal(subject, 'Yesterday at Latent · 1 new account · 0 sales');
  assert.match(text, /0 opened \(—\)/u);
  assert.doesNotMatch(text, /FROM YOUR LINKS/u);
});

test('it goes from the sending domain as name and address apart, which the mailer admits', async () => {
  assert.ok(DIGEST_FROM.email.endsWith('@mail.latentstudios.art'));
  assert.equal(previousDay(new Date('2026-10-15T06:00:00Z')), '2026-10-14');
  const empty = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), first: async () => ({ n: 0, minor: 0 }) }) }) };
  const sent = [];
  const result = await sendDigest({ DIGEST_TO: 'owner@example.com', COUNTS: empty, LICENSING: empty, ACCOUNTS: empty,
    MAILER: { async send(message) { sent.push(message); } } }, new Date('2026-10-15T06:00:00Z'));
  assert.equal(result.sent, true);
  assert.equal(sent[0].to, 'owner@example.com');
  assert.deepEqual(sent[0].from, DIGEST_FROM);
  assert.deepEqual(await sendDigest({ COUNTS: empty }), { sent: false, reason: 'not_configured' });
});

test('sales are plans still standing: refunds, chargebacks and the owner\'s test accounts never count; Stripe, not Paddle', async () => {
  const { text } = composeDigest({ ...sample, refunds: 1 });
  assert.match(text, /^Refunded or charged back: 1$/mu);
  assert.match(text, /^Stripe: https:\/\/dashboard\.stripe\.com\/payments$/mu);
  assert.doesNotMatch(text, /Paddle/u);
  assert.doesNotMatch(composeDigest(sample).text, /Refunded/u);

  const asked = [];
  const db = { prepare: (sql) => ({ bind: (...args) => { asked.push({ sql, args }); return {
    all: async () => ({ results: [] }), first: async () => ({ n: 0, minor: 0 }) }; } }) };
  const owner = '6422c01a-2bcc-4ffb-ad14-71b2ea8f4ef1';
  const { gatherDigest } = await import('../workers/digest/src/digest.js');
  await gatherDigest({ COUNTS: db, ACCOUNTS: db, LICENSING: db, DIGEST_EXCLUDE_ACCOUNTS: ` ${owner}, not-an-id ` }, '2026-10-19');
  const licensing = asked.filter((q) => /commercial_entitlements/u.test(q.sql));
  assert.equal(licensing.length, 4);
  for (const q of licensing) {
    assert.ok(q.args.includes(owner), q.sql);
    assert.ok(!q.args.includes('not-an-id'));
    // Every ?n the statement names has a value bound.
    const highest = Math.max(...[...q.sql.matchAll(/\?(\d+)/gu)].map((m) => Number(m[1])));
    assert.equal(q.args.length, highest, q.sql);
  }
  assert.ok(licensing.some((q) => /status = 'active' AND purchase_reversed_at IS NULL/u.test(q.sql)));
});
