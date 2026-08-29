const RELEASE = Object.freeze({
  key: 'print-engine/beta/0.1.170/Latent-Print-Engine-0.1.170-Beta-Full.pkg',
  filename: 'Latent-Print-Engine-0.1.170-Beta-Full.pkg',
  sha256: '22705054e4d237999f440f4970180eab6f409371a3ea7def397182d2c93425ef',
});

const encoder = new TextEncoder();

async function tokensMatch(candidate, expected) {
  if (!candidate || !expected) return false;

  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);

  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

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

function releaseHeaders(object, length) {
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${RELEASE.filename}"`,
    'Content-Length': String(length),
    'Content-Type': 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Latent-Release-SHA256': RELEASE.sha256,
  });
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return headers;
}

async function serve(context) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Not found', { status: 404 });
  }

  const access = new URL(request.url).searchParams.get('access');
  if (!(await tokensMatch(access, env.LATENT_BETA_DOWNLOAD_TOKEN))) {
    return new Response('Not found', { status: 404 });
  }

  const metadata = await env.LATENT_RELEASES.head(RELEASE.key);
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
    return new Response(null, { headers: releaseHeaders(metadata, metadata.size) });
  }

  const object = await env.LATENT_RELEASES.get(
    RELEASE.key,
    requestedRange ? { range: requestedRange } : undefined,
  );
  if (!object?.body) return new Response('Release unavailable', { status: 503 });

  const length = requestedRange?.length ?? metadata.size;
  const headers = releaseHeaders(object, length);
  if (requestedRange) {
    const end = requestedRange.offset + requestedRange.length - 1;
    headers.set('Content-Range', `bytes ${requestedRange.offset}-${end}/${metadata.size}`);
  }

  return new Response(object.body, {
    status: requestedRange ? 206 : 200,
    headers,
  });
}

export const onRequestGet = serve;
export const onRequestHead = serve;
