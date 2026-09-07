import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';

test('old website URLs preserve path and query on the studio domain', async () => {
  for (const host of ['latentritual.com', 'www.latentritual.com', 'www.latentstudios.art', 'latentritual-site.pages.dev']) {
    for (const path of ['/', '/ritual', '/beta/example?access=a%2Bb&source=old', '/api/print-engine/download?invite=example']) {
      const result = await onRequest({ request: new Request(`https://${host}${path}`), next: () => assert.fail('alias served content') });
      assert.equal(result.status, 308);
      assert.equal(result.headers.get('location'), `https://latentstudios.art${path}`);
    }
  }
});

test('canonical, preview, and app hosts pass through without redirect loops', async () => {
  for (const host of ['latentstudios.art', 'preview.latentritual-site.pages.dev', 'join.latentritual.com', 'join.latentstudios.art', 'field.latentstudios.art', 'versos.latentstudios.art']) {
    const result = await onRequest({ request: new Request(`https://${host}/c/example`), next: () => new Response('untouched') });
    assert.equal(await result.text(), 'untouched');
  }
});

test('legacy Resolve page goes directly to its final destination', () => {
  for (const path of ['/resolve', '/resolve/']) {
    const result = onRequest({ request: new Request(`https://latentritual.com${path}?from=bookmark`), next: () => assert.fail('legacy route served') });
    assert.equal(result.headers.get('location'), 'https://latentstudios.art/lab?from=bookmark');
  }
});

test('form submissions use a method-preserving permanent redirect', () => {
  const result = onRequest({ request: new Request('https://latentritual.com/api/subscribe', { method: 'POST', body: 'email=example' }), next: () => assert.fail('old origin handled submission') });
  assert.equal(result.status, 308);
  assert.equal(result.headers.get('location'), 'https://latentstudios.art/api/subscribe');
});
