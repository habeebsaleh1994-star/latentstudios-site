import { ritualCommerce } from '../config/ritual-commerce.js';
import { countDownload } from './download-count.js';
import { countStep } from './funnel-count.js';

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

function headersFor(release, object, length) {
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'Content-Disposition': `attachment; filename="${release.filename}"`,
    'Content-Length': String(length),
    'Content-Type': release.filename.endsWith('.dmg') ? 'application/x-apple-diskimage' : 'application/zip',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Latent-Release-SHA256': release.sha256,
  });
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return headers;
}

export async function serveManagerApplication(
  context,
  { commerceOpen = ritualCommerce.releaseOpen, release = ritualCommerce.manager } = {},
) {
  const { request, env } = context;
  if (!commerceOpen || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return new Response('Not found', { status: 404 });
  }
  if (!/^[a-f0-9]{64}$/u.test(release.sha256 ?? '')) {
    return new Response('Release unavailable', { status: 503 });
  }
  const metadata = await env.LATENT_RELEASES.head(release.key);
  if (!metadata || metadata.size <= 0) return new Response('Release unavailable', { status: 503 });

  const requestedRange = parseRange(request.headers.get('Range'), metadata.size);
  if (requestedRange === false) {
    return new Response(null, {
      status: 416,
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${metadata.size}` },
    });
  }
  const headers = headersFor(release, metadata, requestedRange?.length ?? metadata.size);
  if (request.method === 'HEAD') return new Response(null, { headers });

  const object = await env.LATENT_RELEASES.get(
    release.key,
    requestedRange ? { range: requestedRange } : undefined,
  );
  if (!object?.body) return new Response('Release unavailable', { status: 503 });
  if (requestedRange) {
    const end = requestedRange.offset + requestedRange.length - 1;
    headers.set('Content-Range', `bytes ${requestedRange.offset}-${end}/${metadata.size}`);
  }
  countDownload(context, 'latent-manager', release.version, requestedRange);
  // Under its source too, when the page that started it was opened from a link we count (src/scripts/source.js).
  if (!requestedRange || requestedRange.offset === 0) countStep(context, 'manager-download', new URL(request.url).searchParams.get('ref'));
  return new Response(object.body, { status: requestedRange ? 206 : 200, headers });
}
