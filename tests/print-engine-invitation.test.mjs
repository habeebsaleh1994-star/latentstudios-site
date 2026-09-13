import assert from 'node:assert/strict';
import test from 'node:test';

import {
  derivePrintEngineInvitation,
  invitationMatches,
  legacyAccessMatches,
} from '../src/server/print-engine-invitation.js';
import {
  onRequestHead as downloadHead,
} from '../functions/api/print-engine/download.js';
import {
  onRequestGet as publicDownloadGet,
  onRequestHead as publicDownloadHead,
} from '../functions/download/print-engine.js';
import {
  onRequestGet as invitationPage,
} from '../functions/beta/[invite].js';

const secret = 'test-release-token-with-at-least-thirty-two-characters';

test('derives one stable, compact invitation from the private release token', async () => {
  const invitation = await derivePrintEngineInvitation(secret);
  assert.match(invitation, /^[A-Za-z0-9_-]{22}$/u);
  assert.equal(invitation, await derivePrintEngineInvitation(secret));
  assert.equal(await invitationMatches(invitation, secret), true);
  assert.equal(await invitationMatches(invitation, `${secret}-different`), false);
  assert.equal(await invitationMatches('too-short', secret), false);
});

test('keeps the already-issued legacy invitation valid', async () => {
  assert.equal(await legacyAccessMatches(secret, secret), true);
  assert.equal(await legacyAccessMatches(`${secret}-wrong`, secret), false);
  assert.equal(await legacyAccessMatches(null, secret), false);
});

test('download gate accepts either authority and rejects invalid invitations', async () => {
  const invitation = await derivePrintEngineInvitation(secret);
  const env = {
    LATENT_BETA_DOWNLOAD_TOKEN: secret,
    LATENT_RELEASES: {
      async head() {
        return { size: 1010067496, httpEtag: 'test-etag' };
      },
    },
  };

  const cleanResponse = await downloadHead({
    env,
    request: new Request(`https://example.test/api/print-engine/download?invite=${invitation}`, { method: 'HEAD' }),
  });
  assert.equal(cleanResponse.status, 200);
  assert.equal(cleanResponse.headers.get('Accept-Ranges'), 'bytes');

  const legacyResponse = await downloadHead({
    env,
    request: new Request(`https://example.test/api/print-engine/download?access=${secret}`, { method: 'HEAD' }),
  });
  assert.equal(legacyResponse.status, 200);

  const invalidResponse = await downloadHead({
    env,
    request: new Request('https://example.test/api/print-engine/download?invite=AAAAAAAAAAAAAAAAAAAAAA', { method: 'HEAD' }),
  });
  assert.equal(invalidResponse.status, 404);
});

test('public download serves the production 1.0.1 release with range support and no private token', async () => {
  const size = 31605354;
  const body = new Uint8Array([1, 2, 3, 4]);
  const env = {
    LATENT_RELEASES: {
      async head() {
        return { size, httpEtag: 'test-etag' };
      },
      async get(key, options) {
        assert.equal(key, 'manager/latent-print-engine/production/1.0.1/Latent-Print-Engine-1.0.1.pkg');
        assert.deepEqual(options, { range: { offset: 10, length: 10 } });
        return { body, httpEtag: 'test-etag' };
      },
    },
  };

  const headResponse = await publicDownloadHead({
    env,
    request: new Request('https://example.test/download/print-engine', { method: 'HEAD' }),
  });
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.headers.get('Content-Length'), String(size));
  assert.equal(headResponse.headers.get('Cache-Control'), 'public, max-age=3600');
  assert.equal(headResponse.headers.get('Content-Disposition'), 'attachment; filename="Latent-Print-Engine-1.0.1.pkg"');
  assert.equal(headResponse.headers.get('X-Latent-Release-SHA256'), 'f58a2857bd562f66e4049fbd8b6df2b7d67b4b69aa2d5674744ff37c0e6e2e2b');

  const rangeResponse = await publicDownloadGet({
    env,
    request: new Request('https://example.test/download/print-engine', {
      headers: { Range: 'bytes=10-19' },
    }),
  });
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.headers.get('Content-Range'), `bytes 10-19/${size}`);
  assert.equal(rangeResponse.headers.get('Content-Length'), '10');
});

test('clean invitation route serves the existing page without redirecting', async () => {
  const invitation = await derivePrintEngineInvitation(secret);
  let assetRequest;
  const env = {
    LATENT_BETA_DOWNLOAD_TOKEN: secret,
    ASSETS: {
      async fetch(request) {
        assetRequest = request;
        return new Response('<!doctype html><title>Private beta</title>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    },
  };

  const response = await invitationPage({
    env,
    params: { invite: invitation },
    request: new Request(`https://example.test/beta/${invitation}`),
  });
  assert.equal(response.status, 200);
  assert.equal(new URL(assetRequest.url).pathname, '/print-engine/beta/');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive, nosnippet');

  const invalidResponse = await invitationPage({
    env,
    params: { invite: 'AAAAAAAAAAAAAAAAAAAAAA' },
    request: new Request('https://example.test/beta/AAAAAAAAAAAAAAAAAAAAAA'),
  });
  assert.equal(invalidResponse.status, 404);
});
