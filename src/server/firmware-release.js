// The firmware downloads, served byte for byte from R2 (config/firmware.js lists them). Ranges are honoured so a
// 3.6 GB download can resume; a download counts once, on the request that starts at the first byte.
import { countDownload, countFinishedDownload } from './download-count.js';
import { firmware, firmwareDownloads, firmwareVersion } from '../config/firmware.js';

function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return false;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return false;
    end = Math.min(end, size - 1);
  }
  return { offset: start, length: end - start + 1 };
}

export function firmwareDownload(slug) {
  return firmwareDownloads.find((item) => item.slug === slug) ?? null;
}

export async function serveFirmwareFile(context, slug, { released = firmware.released } = {}) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Not found', { status: 404 });
  const file = firmwareDownload(slug);
  if (!released || !file || !file.sha256) return new Response('Not found', { status: 404 });
  const metadata = await env.LATENT_RELEASES.head(file.key);
  if (!metadata || (file.bytes && metadata.size !== file.bytes)) return new Response('Download unavailable', { status: 503 });

  const range = parseRange(request.headers.get('Range'), metadata.size);
  if (range === false) {
    return new Response(null, { status: 416, headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${metadata.size}` } });
  }
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'Content-Disposition': `attachment; filename="${file.filename}"`,
    'Content-Type': 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Latent-Release-SHA256': file.sha256,
  });
  if (metadata.httpEtag) headers.set('ETag', metadata.httpEtag);
  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(metadata.size));
    return new Response(null, { headers });
  }
  const object = await env.LATENT_RELEASES.get(file.key, range ? { range } : undefined);
  if (!object?.body) return new Response('Download unavailable', { status: 503 });
  const length = range?.length ?? metadata.size;
  headers.set('Content-Length', String(length));
  if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`);
  const product = `the-ritual-5d/${slug}`;
  countDownload(context, product, firmwareVersion, range);
  const reachesEnd = !range || range.offset + range.length === metadata.size;
  const body = reachesEnd ? whenDelivered(context, object.body, length, () => countFinishedDownload(context, product, firmwareVersion)) : object.body;
  return new Response(body, { status: range ? 206 : 200, headers });
}

/// Hands the file on unchanged and calls `done` only once all of it has been taken up by the reader. The bytes go
/// through Cloudflare's own fixed-length stream (no script runs per piece, so 3.6 GB costs no CPU time, and the
/// response keeps its exact length for progress bars and resuming). A reader who closes the tab or loses the line
/// cancels the stream, the pipe fails, and `done` never runs for a download that did not finish.
function whenDelivered(context, body, length, done) {
  if (!body || typeof body.pipeTo !== 'function') return body;
  const Fixed = globalThis.FixedLengthStream;
  const pass = Fixed ? new Fixed(length) : new TransformStream();
  const delivered = body.pipeTo(pass.writable).then(done, () => {});
  context.waitUntil?.(delivered);
  return pass.readable;
}
