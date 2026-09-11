const MANAGER_CHANNELS = new Set(['production', 'qa']);
const MAXIMUM_FEED_BYTES = 100_000;

function validChannel(channel) {
  return typeof channel === 'string' && MANAGER_CHANNELS.has(channel);
}

function validVersion(version) {
  return typeof version === 'string'
    && /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/u.test(version);
}

export function managerFeedKey(channel) {
  if (!validChannel(channel)) return null;
  return `manager/latent-print-engine/${channel}/release.json`;
}

export function managerPackageKey(channel, version) {
  if (!validChannel(channel) || !validVersion(version)) return null;
  return `manager/latent-print-engine/${channel}/${version}/Latent-Print-Engine-${version}.pkg`;
}

function boundaryHeaders(cacheControl) {
  return new Headers({
    'Cache-Control': cacheControl,
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
}

function statusResponse(body, status) {
  const headers = boundaryHeaders('no-store');
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(body, { status, headers });
}

function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return false;
  let offset;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return false;
    offset = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    offset = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end)) return false;
    if (offset < 0 || offset >= size || end < offset) return false;
    end = Math.min(end, size - 1);
  }
  return { offset, length: end - offset + 1 };
}

export async function serveManagerFeed({ request, env }, channel) {
  const key = managerFeedKey(channel);
  if (!key || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return statusResponse('Not found', 404);
  }
  const object = request.method === 'HEAD'
    ? await env.LATENT_RELEASES.head(key)
    : await env.LATENT_RELEASES.get(key);
  if (!object || object.size <= 0 || object.size > MAXIMUM_FEED_BYTES) {
    return statusResponse('Release unavailable', 503);
  }
  const headers = boundaryHeaders('no-store');
  headers.set('Content-Length', String(object.size));
  headers.set('Content-Type', 'application/json');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  if (request.method === 'HEAD') return new Response(null, { headers });
  if (!object.body) return statusResponse('Release unavailable', 503);
  return new Response(object.body, { headers });
}

export async function serveManagerPackage({ request, env }, channel, version) {
  const key = managerPackageKey(channel, version);
  if (!key || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return statusResponse('Not found', 404);
  }
  const metadata = await env.LATENT_RELEASES.head(key);
  if (!metadata || metadata.size <= 0) {
    return statusResponse('Release unavailable', 503);
  }
  const requestedRange = parseRange(request.headers.get('Range'), metadata.size);
  if (requestedRange === false) {
    const headers = boundaryHeaders('public, max-age=31536000, immutable');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Range', `bytes */${metadata.size}`);
    return new Response(null, { status: 416, headers });
  }
  const headers = boundaryHeaders('public, max-age=31536000, immutable');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Type', 'application/octet-stream');
  headers.set(
    'Content-Disposition',
    `attachment; filename="Latent-Print-Engine-${version}.pkg"`,
  );
  headers.set('Content-Length', String(requestedRange?.length ?? metadata.size));
  if (metadata.httpEtag) headers.set('ETag', metadata.httpEtag);
  if (request.method === 'HEAD') return new Response(null, { headers });

  const object = await env.LATENT_RELEASES.get(
    key,
    requestedRange ? { range: requestedRange } : undefined,
  );
  if (!object?.body) return statusResponse('Release unavailable', 503);
  if (requestedRange) {
    const end = requestedRange.offset + requestedRange.length - 1;
    headers.set(
      'Content-Range',
      `bytes ${requestedRange.offset}-${end}/${metadata.size}`,
    );
  }
  return new Response(object.body, {
    status: requestedRange ? 206 : 200,
    headers,
  });
}
