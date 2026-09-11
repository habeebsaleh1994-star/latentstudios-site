export const PRINT_ENGINE_RELEASE = Object.freeze({
  key: 'print-engine/beta/0.1.170/Latent-Print-Engine-0.1.170-Beta-Full.pkg',
  filename: 'Latent-Print-Engine-0.1.170-Beta-Full.pkg',
  sha256: '22705054e4d237999f440f4970180eab6f409371a3ea7def397182d2c93425ef',
});

function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return false;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return false;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return false;
    if (start < 0 || start >= size || end < start) return false;
    end = Math.min(end, size - 1);
  }

  return { offset: start, length: end - start + 1 };
}

function releaseHeaders(object, length, cacheControl) {
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheControl,
    'Content-Disposition': `attachment; filename="${PRINT_ENGINE_RELEASE.filename}"`,
    'Content-Length': String(length),
    'Content-Type': 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Latent-Release-SHA256': PRINT_ENGINE_RELEASE.sha256,
  });
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return headers;
}

export async function servePrintEngineRelease(context, { cacheControl = 'private, no-store' } = {}) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Not found', { status: 404 });
  }

  const metadata = await env.LATENT_RELEASES.head(PRINT_ENGINE_RELEASE.key);
  if (!metadata) return new Response('Release unavailable', { status: 503 });

  const requestedRange = parseRange(request.headers.get('Range'), metadata.size);
  if (requestedRange === false) {
    return new Response(null, {
      status: 416,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${metadata.size}`,
      },
    });
  }

  if (request.method === 'HEAD') {
    return new Response(null, {
      headers: releaseHeaders(metadata, metadata.size, cacheControl),
    });
  }

  const object = await env.LATENT_RELEASES.get(
    PRINT_ENGINE_RELEASE.key,
    requestedRange ? { range: requestedRange } : undefined,
  );
  if (!object?.body) return new Response('Release unavailable', { status: 503 });

  const length = requestedRange?.length ?? metadata.size;
  const headers = releaseHeaders(object, length, cacheControl);
  if (requestedRange) {
    const end = requestedRange.offset + requestedRange.length - 1;
    headers.set('Content-Range', `bytes ${requestedRange.offset}-${end}/${metadata.size}`);
  }

  return new Response(object.body, {
    status: requestedRange ? 206 : 200,
    headers,
  });
}
