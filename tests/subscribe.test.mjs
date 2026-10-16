import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { onRequestPost } from '../functions/api/subscribe.js';

// D1's surface over a real in-memory SQLite.
function database() {
  const sqlite = new DatabaseSync(':memory:');
  const statement = (sql, args = []) => ({
    bind: (...bound) => statement(sql, bound),
    run: async () => { sqlite.prepare(sql).run(...args); return { meta: {} }; },
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
  });
  return { sqlite, prepare: (sql) => statement(sql) };
}

const rows = (db) => db.sqlite.prepare('SELECT * FROM newsletter_signups ORDER BY email').all();

function post(body) {
  return new Request('https://latentstudios.art/api/subscribe', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

function buttondown(answer) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return answer(); };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('Buttondown refusing (a plan limit) no longer loses the person: kept, marked, and told they are on the list', async () => {
  const db = database();
  const bd = buttondown(() => new Response(JSON.stringify({ code: 'subscriber_limit_reached' }), { status: 400 }));
  try {
    const res = await onRequestPost({ request: post({ email: ' Reel.Viewer@Example.com ', list: 'firmware' }), env: { DOWNLOAD_COUNTS: db, BUTTONDOWN_API_KEY: 'k' } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, kept: true });
  } finally { bd.restore(); }
  const [row] = rows(db);
  assert.equal(row.email, 'reel.viewer@example.com');
  assert.equal(row.tags, 'firmware');
  assert.equal(row.buttondown_at, null);
  assert.match(row.buttondown_error, /^400 subscriber_limit_reached/u);
});

test('accepted by Buttondown: kept and marked as delivered; signing up again adds tags, never a second row', async () => {
  const db = database();
  const bd = buttondown(() => new Response('{}', { status: 201 }));
  try {
    const env = { DOWNLOAD_COUNTS: db, BUTTONDOWN_API_KEY: 'k' };
    assert.deepEqual(await (await onRequestPost({ request: post({ email: 'a@example.com', list: 'firmware' }), env })).json(), { ok: true, created: true });
    await onRequestPost({ request: post({ email: 'A@example.com', list: 'nera' }), env });
    assert.deepEqual(bd.calls.map((call) => call.body.tags), [['firmware'], ['nera']]);
  } finally { bd.restore(); }
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0].tags, 'firmware,nera');
  assert.ok(all[0].buttondown_at);
  assert.equal(all[0].buttondown_error, null);
});

test('Buttondown unreachable, or no key: still kept and still "on the list"', async () => {
  const db = database();
  const bd = buttondown(() => { throw new Error('offline'); });
  try {
    const res = await onRequestPost({ request: post({ email: 'b@example.com' }), env: { DOWNLOAD_COUNTS: db, BUTTONDOWN_API_KEY: 'k' } });
    assert.deepEqual(await res.json(), { ok: true, kept: true });
    const none = await onRequestPost({ request: post({ email: 'c@example.com' }), env: { DOWNLOAD_COUNTS: db } });
    assert.deepEqual(await none.json(), { ok: true, kept: true });
  } finally { bd.restore(); }
  assert.deepEqual(rows(db).map((row) => [row.email, row.buttondown_error]), [['b@example.com', 'upstream_unreachable'], ['c@example.com', 'not_configured']]);
});

test('without our database a refusal is still reported honestly, and bad input stores nothing', async () => {
  const bd = buttondown(() => new Response('{"code":"subscriber_limit_reached"}', { status: 400 }));
  try {
    const res = await onRequestPost({ request: post({ email: 'd@example.com' }), env: { BUTTONDOWN_API_KEY: 'k' } });
    assert.equal(res.status, 502);
    const db = database();
    const bad = await onRequestPost({ request: post({ email: 'nope' }), env: { DOWNLOAD_COUNTS: db, BUTTONDOWN_API_KEY: 'k' } });
    assert.equal(bad.status, 400);
    const bot = await onRequestPost({ request: post({ email: 'e@example.com', website: 'x' }), env: { DOWNLOAD_COUNTS: db, BUTTONDOWN_API_KEY: 'k' } });
    assert.deepEqual(await bot.json(), { ok: true });
    assert.equal(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'newsletter_signups'").get(), undefined);
  } finally { bd.restore(); }
});
