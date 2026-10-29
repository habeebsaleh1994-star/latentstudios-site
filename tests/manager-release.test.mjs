import assert from 'node:assert/strict';
import test from 'node:test';

import {
  onRequestGet as feedGet,
  onRequestHead as feedHead,
} from '../functions/api/manager/releases/latent-print-engine/[channel].js';
import {
  onRequestGet as packageGet,
  onRequestHead as packageHead,
} from '../functions/api/manager/packages/latent-print-engine/[channel]/[version].js';
import {
  onRequestGet as ritualFeedGet,
  onRequestHead as ritualFeedHead,
} from '../functions/api/manager/releases/latent-ritual/[channel].js';
import {
  onRequestGet as ritualPackageGet,
  onRequestHead as ritualPackageHead,
} from '../functions/api/manager/packages/latent-ritual/[channel]/[version].js';
import { onRequestGet as managerFeedGet } from '../functions/api/manager/releases/latent-manager/[channel].js';
import {
  onRequestGet as managerPackageGet,
} from '../functions/api/manager/packages/latent-manager/[channel]/[version].js';
import {
  onRequestGet as contentFeedGet,
} from '../functions/api/manager/content/latent-print-engine/[channel]/[collection].js';
import {
  onRequestGet as contentAssetGet,
  onRequestHead as contentAssetHead,
} from '../functions/api/manager/content/latent-print-engine/[channel]/[collection]/[version]/[file].js';

import {
  onRequestGet as fileGet,
  onRequestHead as fileHead,
} from '../functions/api/manager/files/[product]/[sha256].js';

function environment(objects) {
  return {
    LATENT_RELEASES: {
      async head(key) {
        const object = objects.get(key);
        return object && { size: object.body.byteLength, httpEtag: object.etag };
      },
      async get(key, options) {
        const object = objects.get(key);
        if (!object) return null;
        if (!options?.range) {
          return { body: object.body, size: object.body.byteLength, httpEtag: object.etag };
        }
        const { offset, length } = options.range;
        return {
          body: object.body.slice(offset, offset + length),
          size: object.body.byteLength,
          httpEtag: object.etag,
        };
      },
    },
  };
}

test('serves only a bounded JSON record from the fixed product/channel key', async () => {
  const body = new TextEncoder().encode('{"signed":"record"}');
  const objects = new Map([
    ['manager/latent-print-engine/production/release.json', { body, etag: 'feed-etag' }],
  ]);
  const context = {
    env: environment(objects),
    params: { channel: 'production' },
    request: new Request(
      'https://latentstudios.art/api/manager/releases/latent-print-engine/production',
    ),
  };
  const response = await feedGet(context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(await response.text(), '{"signed":"record"}');

  const head = await feedHead({ ...context, request: new Request(context.request, { method: 'HEAD' }) });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), String(body.byteLength));
  assert.equal(await head.text(), '');

  const invalid = await feedGet({ ...context, params: { channel: '../production' } });
  assert.equal(invalid.status, 404);
});

test('refuses oversized update records before reading their body', async () => {
  let bodyRead = false;
  const response = await feedGet({
    params: { channel: 'production' },
    request: new Request(
      'https://latentstudios.art/api/manager/releases/latent-print-engine/production',
    ),
    env: {
      LATENT_RELEASES: {
        async head() { return { size: 100_001 }; },
        async get() {
          return {
            get body() { bodyRead = true; return new Uint8Array(100_001); },
            size: 100_001,
          };
        },
      },
    },
  });
  assert.equal(response.status, 503);
  assert.equal(bodyRead, false);
});

test('serves immutable versioned packages with exact byte ranges', async () => {
  const body = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  const key = 'manager/latent-print-engine/production/1.2.3/Latent-Print-Engine-1.2.3.pkg';
  const objects = new Map([[key, { body, etag: 'package-etag' }]]);
  const base = {
    env: environment(objects),
    params: { channel: 'production', version: '1.2.3' },
  };
  const head = await packageHead({
    ...base,
    request: new Request(
      'https://latentstudios.art/api/manager/packages/latent-print-engine/production/1.2.3',
      { method: 'HEAD' },
    ),
  });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(head.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');

  const response = await packageGet({
    ...base,
    request: new Request(
      'https://latentstudios.art/api/manager/packages/latent-print-engine/production/1.2.3',
      { headers: { Range: 'bytes=2-5' } },
    ),
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/8');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body.slice(2, 6));

  const traversal = await packageGet({
    ...base,
    params: { channel: 'production', version: '../1.2.3' },
    request: new Request('https://latentstudios.art/invalid'),
  });
  assert.equal(traversal.status, 404);
});

test('serves Ritual only from its own fixed feed and application archive keys', async () => {
  const feedBody = new TextEncoder().encode('{"signed":"ritual-record"}');
  const packageBody = new Uint8Array([20, 21, 22, 23, 24, 25]);
  const objects = new Map([
    ['manager/latent-ritual/qa/release.json', { body: feedBody, etag: 'ritual-feed' }],
    [
      'manager/latent-ritual/qa/1.0.0/Latent-The-Ritual-1.0.0.zip',
      { body: packageBody, etag: 'ritual-package' },
    ],
  ]);
  const feedContext = {
    env: environment(objects),
    params: { channel: 'qa' },
    request: new Request('https://latentstudios.art/api/manager/releases/latent-ritual/qa'),
  };
  const feed = await ritualFeedGet(feedContext);
  assert.equal(feed.status, 200);
  assert.equal(feed.headers.get('Content-Type'), 'application/json');
  assert.equal(await feed.text(), '{"signed":"ritual-record"}');
  const feedHead = await ritualFeedHead({
    ...feedContext,
    request: new Request(feedContext.request, { method: 'HEAD' }),
  });
  assert.equal(feedHead.status, 200);
  assert.equal(feedHead.headers.get('Content-Length'), String(feedBody.byteLength));

  const packageContext = {
    env: environment(objects),
    params: { channel: 'qa', version: '1.0.0' },
    request: new Request(
      'https://latentstudios.art/api/manager/packages/latent-ritual/qa/1.0.0',
      { headers: { Range: 'bytes=1-4' } },
    ),
  };
  const response = await ritualPackageGet(packageContext);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 1-4/6');
  assert.equal(
    response.headers.get('Content-Disposition'),
    'attachment; filename="Latent-The-Ritual-1.0.0.zip"',
  );
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), packageBody.slice(1, 5));
  const packageHead = await ritualPackageHead({
    ...packageContext,
    request: new Request(packageContext.request.url, { method: 'HEAD' }),
  });
  assert.equal(packageHead.status, 200);
  assert.equal(packageHead.headers.get('Content-Length'), String(packageBody.byteLength));

  const printEngineRoute = await packageGet(packageContext);
  assert.equal(printEngineRoute.status, 503);
});

test('serves Latent Manager its own feed and archive, apart from every product', async () => {
  const feedBody = new TextEncoder().encode('{"signed":"manager-record"}');
  const packageBody = new Uint8Array([30, 31, 32, 33]);
  const objects = new Map([
    ['manager/latent-manager/production/release.json', { body: feedBody, etag: 'manager-feed' }],
    [
      'manager/latent-manager/production/1.1.6/Latent-Manager-1.1.6.zip',
      { body: packageBody, etag: 'manager-package' },
    ],
  ]);
  const feed = await managerFeedGet({
    env: environment(objects),
    params: { channel: 'production' },
    request: new Request('https://latentstudios.art/api/manager/releases/latent-manager/production'),
  });
  assert.equal(feed.status, 200);
  assert.equal(await feed.text(), '{"signed":"manager-record"}');

  const packageContext = {
    env: environment(objects),
    params: { channel: 'production', version: '1.1.6' },
    request: new Request('https://latentstudios.art/api/manager/packages/latent-manager/production/1.1.6'),
  };
  const response = await managerPackageGet(packageContext);
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('Content-Disposition'),
    'attachment; filename="Latent-Manager-1.1.6.zip"',
  );
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), packageBody);
  assert.equal((await ritualPackageGet(packageContext)).status, 503);
});

test('serves the bounded content catalog from one fixed collection', async () => {
  const body = new TextEncoder().encode('{"signed":"content"}');
  const objects = new Map([[
    'manager/latent-print-engine/production/content/core-plates/release.json',
    { body, etag: 'content-feed-etag' },
  ]]);
  const context = {
    env: environment(objects),
    params: { channel: 'production', collection: 'core-plates' },
    request: new Request(
      'https://latentstudios.art/api/manager/content/latent-print-engine/production/core-plates',
    ),
  };
  const response = await contentFeedGet(context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(await response.text(), '{"signed":"content"}');
  assert.equal(
    (await contentFeedGet({ ...context, params: { ...context.params, collection: '../plates' } })).status,
    404,
  );
});

test('serves immutable encrypted assets with exact byte ranges', async () => {
  const body = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17]);
  const key =
    'manager/latent-print-engine/production/content/core-plates/3/35mm_matte.latentplate';
  const objects = new Map([[key, { body, etag: 'asset-etag' }]]);
  const base = {
    env: environment(objects),
    params: {
      channel: 'production', collection: 'core-plates', version: '3',
      file: '35mm_matte.latentplate',
    },
  };
  const url =
    'https://latentstudios.art/api/manager/content/latent-print-engine/production/core-plates/3/35mm_matte.latentplate';
  const head = await contentAssetHead({
    ...base, request: new Request(url, { method: 'HEAD' }),
  });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(head.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');

  const response = await contentAssetGet({
    ...base, request: new Request(url, { headers: { Range: 'bytes=2-5' } }),
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/8');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body.slice(2, 6));
  assert.equal(
    (await contentAssetGet({
      ...base,
      params: { ...base.params, file: '../secret.latentplate' },
      request: new Request(url),
    })).status,
    404,
  );
});

test('counts a package as an install, update or repair when Manager says which, once, on its first byte', async () => {
  const tallies = [];
  const db = { prepare: (sql) => ({ bind: (...args) => ({ run: async () => { tallies.push(args); } }) }) };
  const body = new Uint8Array(8);
  const key = 'manager/latent-ritual/production/1.0.10/Latent-The-Ritual-1.0.10.zip';
  const env = { ...environment(new Map([[key, { body, etag: 'e' }]])), DOWNLOAD_COUNTS: db };
  const get = (headers) => ritualPackageGet({
    env,
    params: { channel: 'production', version: '1.0.10' },
    request: new Request('https://latentstudios.art/api/manager/packages/latent-ritual/production/1.0.10', { headers }),
  });
  await get({ Range: 'bytes=0-7', 'X-Latent-Download': 'install' });
  await get({ Range: 'bytes=4-7', 'X-Latent-Download': 'install' }); // a later piece: not a new download
  await get({ 'X-Latent-Download': 'update' });
  await get({ 'X-Latent-Download': 'Repair ' });
  await get({ 'X-Latent-Download': 'something-else' }); // unknown words keep the plain key
  await get({}); // a Manager from before 1.1.11 says nothing
  assert.deepEqual(tallies.map((args) => args[1]), [
    'latent-ritual/production/install',
    'latent-ritual/production/update',
    'latent-ritual/production/repair',
    'latent-ritual/production',
    'latent-ritual/production',
  ]);
});

test('serves an application file only by its exact SHA-256, with byte ranges, for the apps Manager assembles', async () => {
  const sha = 'a'.repeat(64);
  const body = new TextEncoder().encode('0123456789');
  const objects = new Map([
    [`manager/latent-ritual/files/${sha}`, { body, etag: 'file-etag' }],
    [`manager/latent-manager/files/${sha}`, { body, etag: 'manager-file' }],
  ]);
  const env = environment(objects);
  const url = (product, name) => `https://latentstudios.art/api/manager/files/${product}/${name}`;
  const call = (handler, product, name, headers = {}, method = 'GET') => handler({
    request: new Request(url(product, name), { method, headers }),
    env,
    params: { product, sha256: name },
  });

  const whole = await call(fileGet, 'latent-ritual', sha);
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.equal(whole.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(whole.headers.get('Content-Length'), '10');
  assert.equal(new TextDecoder().decode(await whole.arrayBuffer()), '0123456789');

  const part = await call(fileGet, 'latent-ritual', sha, { Range: 'bytes=2-5' });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.equal(new TextDecoder().decode(await part.arrayBuffer()), '2345');

  const head = await call(fileHead, 'latent-manager', sha, {}, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), '10');

  const outOfRange = await call(fileGet, 'latent-ritual', sha, { Range: 'bytes=20-30' });
  assert.equal(outOfRange.status, 416);
  assert.equal(outOfRange.headers.get('Content-Range'), 'bytes */10');

  // Nothing but 64 lowercase hex names a file; no other product; nothing missing is invented.
  for (const name of [
    'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), `${'a'.repeat(62)}..`, '../release.json',
    `${'a'.repeat(63)}/`, '%2e%2e', '', `${'a'.repeat(63)}g`,
  ]) {
    assert.equal((await call(fileGet, 'latent-ritual', name)).status, 404, `refuses ${JSON.stringify(name)}`);
  }
  for (const product of ['latent-print-engine', 'latent-ritual/../latent-manager', 'other', '']) {
    assert.equal((await call(fileGet, product, sha)).status, 404, `refuses product ${JSON.stringify(product)}`);
  }
  assert.equal((await call(fileGet, 'latent-ritual', 'b'.repeat(64))).status, 503, 'a file not uploaded');
});
