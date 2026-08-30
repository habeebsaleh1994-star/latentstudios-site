import { invitationMatches } from '../../src/server/print-engine-invitation.js';

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function serve(context) {
  const { env, params, request } = context;
  if (!(await invitationMatches(params.invite, env.LATENT_BETA_DOWNLOAD_TOKEN))) {
    return notFound();
  }

  const assetURL = new URL('/print-engine/beta/', request.url);
  const assetRequest = new Request(assetURL, {
    method: request.method,
    headers: request.headers,
  });
  const asset = await env.ASSETS.fetch(assetRequest);
  const headers = new Headers(asset.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  return new Response(asset.body, {
    status: asset.status,
    statusText: asset.statusText,
    headers,
  });
}

export const onRequestGet = serve;
export const onRequestHead = serve;
