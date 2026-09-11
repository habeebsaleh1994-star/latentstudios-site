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
