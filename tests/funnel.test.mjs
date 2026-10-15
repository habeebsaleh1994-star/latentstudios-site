import assert from 'node:assert/strict';
import test from 'node:test';

import { FUNNEL_SOURCES, funnelSource, withSource } from '../src/config/funnel.js';
import { countStep } from '../src/server/funnel-count.js';
import { handleSendToMac } from '../src/server/send-to-mac.js';
import { onRequest as middleware } from '../functions/_middleware.js';

// A D1 stand-in that records each tally's bindings.
function countsDatabase() {
  const tallies = [];
  return {
    tallies,
    prepare(sql) {
      return { bind: (...args) => ({ run: async () => { tallies.push({ sql, args }); } }) };
    },
  };
}

const steps = (db) => db.tallies.filter((t) => t.sql.includes('funnel_counts')).map((t) => `${t.args[1]}:${t.args[2]}`);

test('only allowlisted sources count, and a link keeps its own query', () => {
  assert.ok(FUNNEL_SOURCES.includes('send-to-mac'));
  assert.equal(funnelSource('YouTube '), 'youtube');
  assert.equal(funnelSource('anything-else'), '');
  assert.equal(funnelSource(null), '');
  assert.equal(withSource('/ritual/purchase', 'instagram'), '/ritual/purchase?ref=instagram');
  assert.equal(withSource('/ritual/purchase?plan=annual', 'instagram'), '/ritual/purchase?plan=annual&ref=instagram');
  assert.equal(withSource('/ritual/purchase', 'made-up'), '/ritual/purchase');
});

test('a tally is numbers only: the day, the step and the source', async () => {
  const db = countsDatabase();
  const pending = [];
  countStep({ env: { DOWNLOAD_COUNTS: db }, waitUntil: (p) => pending.push(p) }, 'page-visit', 'youtube');
  countStep({ env: { DOWNLOAD_COUNTS: db } }, 'page-visit', 'not-a-source');
  countStep({ env: { DOWNLOAD_COUNTS: db } }, 'not-a-step', 'youtube');
  countStep({ env: {} }, 'page-visit', 'youtube');
  await Promise.all(pending);
  assert.equal(db.tallies.length, 1);
  const [day, step, source] = db.tallies[0].args;
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/u);
  assert.deepEqual([step, source], ['page-visit', 'youtube']);
  assert.equal(db.tallies[0].args.length, 3);
});

test('a sent send-to-Mac email counts once; a failed one does not', async () => {
  const request = () => new Request('https://latentstudios.art/api/send-to-mac', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@example.com' }),
  });
  const db = countsDatabase();
  const ok = { name: 'test', from: 'x', async send() {} };
  await handleSendToMac({ request: request(), env: { DOWNLOAD_COUNTS: db } }, { mailer: ok, limit: async () => true });
  assert.deepEqual(steps(db), ['link-sent:send-to-mac']);

  const failing = { name: 'test', from: 'x', async send() { throw new Error('down'); } };
  const error = console.error;
  console.error = () => {};
  try {
    await handleSendToMac({ request: request(), env: { DOWNLOAD_COUNTS: db } }, { mailer: failing, limit: async () => true });
  } finally { console.error = error; }
  assert.deepEqual(steps(db), ['link-sent:send-to-mac']);
});

test('the middleware counts a page opened from a counted link, never an API call or a stray ref', async () => {
  const db = countsDatabase();
  const visit = (path, method = 'GET') => middleware({
    request: new Request(`https://latentstudios.art${path}`, { method }),
    env: { DOWNLOAD_COUNTS: db },
    next: async () => new Response('page'),
  });
  await visit('/ritual/purchase?plan=annual&ref=send-to-mac');
  await visit('/ritual?ref=youtube');
  await visit('/ritual?ref=whatever');
  await visit('/ritual');
  await visit('/api/send-to-mac?ref=youtube', 'POST');
  await visit('/download/manager?ref=youtube');
  assert.deepEqual(steps(db), ['page-visit:send-to-mac', 'page-visit:youtube']);
});

test('a Manager download from a counted link counts under its source, once, on its first byte', async () => {
  const { serveManagerApplication } = await import('../src/server/manager-application-release.js');
  const db = countsDatabase();
  const release = { key: 'manager/latest.dmg', filename: 'Latent Manager.dmg', sha256: 'a'.repeat(64), version: '1.1.7' };
  const releases = {
    async head() { return { size: 10 }; },
    async get() { return { body: new Uint8Array(10) }; },
  };
  const get = (path, headers = {}) => serveManagerApplication(
    { request: new Request(`https://latentstudios.art${path}`, { headers }), env: { LATENT_RELEASES: releases, DOWNLOAD_COUNTS: db } },
    { commerceOpen: true, release },
  );
  await get('/download/manager?ref=send-to-mac');
  await get('/download/manager?ref=send-to-mac', { Range: 'bytes=5-9' }); // a later piece: not a new download
  await get('/download/manager');
  await get('/download/manager?ref=nope');
  assert.deepEqual(steps(db), ['manager-download:send-to-mac']);
});
