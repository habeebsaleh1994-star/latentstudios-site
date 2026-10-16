import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { chooseMailer, composeEmail, handleSendToMac, LIMITS } from '../src/server/send-to-mac.js';
import { ritualPlanSummary, ritualPlan, ritualPurchasePath, ritualManagerPlanURL } from '../src/config/ritual-commerce.js';

const post = (body, headers = {}) => new Request('https://latentstudios.art/api/send-to-mac', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...headers },
  body: JSON.stringify(body),
});
const open = async () => true;

test('plan words and links match the approved copy', () => {
  assert.equal(ritualPlanSummary(ritualPlan('annual')), 'Annual · $149.99 a year');
  assert.equal(ritualPlanSummary(ritualPlan('perpetual')), 'Yours to keep · $599 once');
  assert.deepEqual(['monthly', 'annual', 'perpetual'].map((id) => ritualPlan(id).choose),
    ['Monthly, in Manager', 'Annual, in Manager', 'To keep, in Manager']);
  assert.equal(ritualPurchasePath('annual'), '/ritual/purchase?plan=annual');
  assert.equal(ritualPurchasePath('nonsense'), '/ritual/purchase');
  assert.equal(ritualManagerPlanURL('monthly'), 'latent-manager://ritual/plans?plan=monthly');
});

test('sends one email with the purchase link, the chosen plan and the four steps', async () => {
  const sent = [];
  const mailer = { name: 'test', from: 'The Ritual <ritual@latentstudios.art>', async send(m) { sent.push(m); } };
  const res = await handleSendToMac({ request: post({ email: 'a@example.com', plan: 'annual' }) }, { mailer, limit: open });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, subscribed: false });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'a@example.com');
  assert.equal(sent[0].subject, 'Open on your Mac: The Ritual');
  for (const body of [sent[0].text, sent[0].html]) {
    assert.match(body, /https:\/\/latentstudios\.art\/ritual\/purchase\?plan=annual/u);
    assert.match(body, /Sign in to your Latent account/u);
    assert.match(body, /Install The Ritual/u);
    assert.match(body, /Annual · \$149\.99 a year/u);
  }
  assert.match(composeEmail('').link, /\/ritual\/purchase\?ref=send-to-mac$/u);
  assert.match(composeEmail('annual').link, /\/ritual\/purchase\?plan=annual&ref=send-to-mac$/u);
});

test('refuses a bad address, drops the honeypot, and limits repeats', async () => {
  const mailer = { name: 'test', from: 'x', async send() { assert.fail('should not send'); } };
  const bad = await handleSendToMac({ request: post({ email: 'not-an-address' }) }, { mailer, limit: open });
  assert.equal(bad.status, 400);
  const trap = await handleSendToMac({ request: post({ email: 'a@example.com', website: 'x' }) }, { mailer, limit: open });
  assert.equal(trap.status, 200);
  const limited = await handleSendToMac({ request: post({ email: 'a@example.com' }) }, { mailer, limit: async () => false });
  assert.equal(limited.status, 429);
  assert.ok(LIMITS.address.max <= 3 && LIMITS.ip.max <= 10);
});

test('the cache limiter counts digests, never the address or the IP', async () => {
  const store = new Map();
  const cache = {
    async match(req) { const v = store.get(req.url); return v && new Response(v); },
    async put(req, res) { store.set(req.url, await res.text()); },
  };
  globalThis.caches = { default: cache };
  try {
    const mailer = { name: 'test', from: 'x', async send() {} };
    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await handleSendToMac({ request: post({ email: 'Repeat@Example.com' }) }, { mailer })).status);
    }
    assert.deepEqual(statuses, [200, 200, 429]);
    for (const key of store.keys()) {
      assert.doesNotMatch(key, /example|203\.0\.113/iu);
      assert.match(key, /\/__send-to-mac-limit\/(ip|address)\/[a-f0-9]{64}$/u);
    }
  } finally {
    delete globalThis.caches;
  }
});

test('without a mailer it answers 503 not_configured; Letters only when ticked', async () => {
  const subscribed = [];
  const subscribe = async (email) => { subscribed.push(email); return true; };
  const quiet = await handleSendToMac({ request: post({ email: 'a@example.com' }), env: {} }, { subscribe, limit: open });
  assert.equal(quiet.status, 503);
  assert.equal((await quiet.json()).error, 'not_configured');
  assert.equal(subscribed.length, 0);
  const asked = await handleSendToMac({ request: post({ email: 'b@example.com', letters: true }), env: {} }, { subscribe, limit: open });
  assert.equal(asked.status, 503);
  assert.deepEqual(subscribed, ['b@example.com']);
  assert.equal(chooseMailer({}), null);
});

test('a failed send logs the reason, never the address', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const mailer = { name: 'test', from: 'x', async send() { throw new Error('upstream 500'); } };
    const res = await handleSendToMac({ request: post({ email: 'secret@example.com' }) }, { mailer, limit: open });
    assert.equal(res.status, 502);
  } finally {
    console.error = original;
  }
  assert.ok(logged.length > 0);
  for (const line of logged) assert.doesNotMatch(line, /secret@example\.com/u);
});

test('the Cloudflare binding and Resend adapters send the same message', async () => {
  const bound = [];
  const cf = chooseMailer({ SEND_EMAIL: { async send(m) { bound.push(m); } } });
  await cf.send({ to: 'a@example.com', from: cf.from, subject: 's', text: 't', html: 'h' });
  assert.deepEqual(bound[0].from, { name: 'The Ritual', email: 'ritual@mail.latentstudios.art' });
  const calls = [];
  const resend = chooseMailer({ RESEND_API_KEY: 're_test' }, async (url, init) => { calls.push({ url, init }); return new Response('{}'); });
  await resend.send({ to: 'a@example.com', from: resend.from, subject: 's', text: 't', html: 'h' });
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.deepEqual(JSON.parse(calls[0].init.body).to, ['a@example.com']);
});

test('the pages carry the approved send-to-Mac and plan words', async () => {
  const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const [ritual, purchase, form] = await Promise.all([
    read('pages/ritual.astro'), read('pages/ritual/purchase.astro'), read('components/SendToMac.astro'),
  ]);
  assert.match(form, /The Ritual runs on your Mac\. Send yourself the link and open it there\./u);
  assert.match(form, /Send it to my Mac/u);
  assert.match(form, /Also send me Letters from the studio/u);
  assert.match(form, /Copy the link/u);
  assert.match(form, /Sent\. Now to your Mac\./u);
  assert.match(form, /Open the email on your Mac: the link there starts the download, with the steps\./u);
  // opened from the email on a phone: the way across, not the form again
  assert.match(form, /You&rsquo;re on your phone\./u);
  assert.match(form, /AirDrop it to my Mac/u);
  assert.match(form, /get\('ref'\) === 'send-to-mac'/u);
  assert.match(form, /Not there in a minute\? Look in Spam or Junk, from \{words\.sender\}\./u);
  assert.match(form, /sender: 'ritual@mail\.latentstudios\.art'/u);
  assert.match(form, /sender: 'lab@mail\.latentstudios\.art'/u);
  assert.match(form, /The Ritual is for Mac \(macOS 26, Apple silicon\)/u);
  assert.match(ritual, /Plans are bought in Latent Manager\. A button above downloads it and opens it on that plan, where you choose and pay\./u);
  assert.match(ritual, /data-choose-plan/u);
  assert.match(purchase, /Already have Latent Manager\? Open it on this plan\./u);
  assert.match(purchase, /Open Manager on this plan/u);
  assert.match(purchase, /Your download has started/u);
  assert.match(purchase, /For macOS 26 on Apple silicon/u);
});

test('the Lab sends its own email: the install link, Print Engine\'s steps, its own sender and reply address', async () => {
  const sent = [];
  const mailer = { name: 'test', from: 'The Ritual <ritual@mail.latentstudios.art>', async send(m) { sent.push(m); } };
  const res = await handleSendToMac({ request: post({ email: 'a@example.com', product: 'lab', plan: 'annual' }) }, { mailer, limit: open });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, 'Open on your Mac: Latent Print Engine');
  assert.equal(sent[0].from, 'Latent Print Engine <lab@mail.latentstudios.art>');
  assert.equal(sent[0].replyTo, 'lab@latentstudios.art');
  for (const body of [sent[0].text, sent[0].html]) {
    assert.match(body, /https:\/\/latentstudios\.art\/lab\/install\?ref=send-to-mac/u);
    assert.match(body, /Quit DaVinci Resolve,/u);
    assert.match(body, /Film Emulation/u);
    assert.match(body, /DaVinci Resolve Studio/u);
    assert.doesNotMatch(body, /The Ritual|ritual\/purchase|\$149/u);
  }
  // The Ritual's email is unchanged when no product is named.
  const ritual = composeEmail('');
  assert.equal(ritual.subject, 'Open on your Mac: The Ritual');
  assert.equal(ritual.replyTo, 'ritual@latentstudios.art');
  assert.equal(ritual.from, null);
  // The Cloudflare binding sends from the message's own sender when it names one.
  const bound = [];
  const cf = chooseMailer({ SEND_EMAIL: { async send(m) { bound.push(m); } } });
  await cf.send({ to: 'a@example.com', from: 'Latent Print Engine <lab@mail.latentstudios.art>', subject: 's', text: 't', html: 'h' });
  assert.deepEqual(bound[0].from, { name: 'Latent Print Engine', email: 'lab@mail.latentstudios.art' });
});

test('the Lab pages: every Download goes through /lab/install, which gives the steps and Send to Mac', async () => {
  const read = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const [lab, install] = await Promise.all([read('pages/lab.astro'), read('pages/lab/install.astro')]);
  assert.doesNotMatch(lab, /href=\{labCommerce\.downloadHref\}/u);
  assert.match(lab, /<SendToMac id="send-mac-lab" product="lab" \/>/u);
  assert.match(lab, /<DeviceProbe \/>/u);
  assert.match(install, /<SendToMac id="send-mac-install" product="lab" \/>/u);
  assert.match(install, /Your download has started/u);
  assert.match(install, /quit DaVinci Resolve/u);
  assert.match(install, /Film Emulation/u);
  assert.match(install, /Guide&hellip;/u);
  assert.match(install, /macOS 14 or later on Apple silicon/u);
});
