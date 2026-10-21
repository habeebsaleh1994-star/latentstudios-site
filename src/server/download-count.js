// The download counter: one anonymous tally per day, product and version (db/download-counts.sql).
// A download counts once, on the request that starts at the first byte -- Manager fetches a package in
// pieces, and HEAD probes and later pieces are not new downloads. No address, browser or account is kept,
// and the tally never delays or fails the download itself.
export function countDownload(context, product, version, range) {
  if (context.request.method !== 'GET' || (range && range.offset !== 0)) return;
  tally(context, product, version);
}

/// A download that reached its last byte: the response's final piece was handed over in full (a broken one never
/// gets there). Counted under `<product>/finished`, once, by whichever request carries the file's end -- the whole
/// file, or the resumed rest of it -- so "finished" counts people who got it, not attempts.
export function countFinishedDownload(context, product, version) {
  tally(context, `${product}/finished`, version);
}

function tally(context, product, version) {
  const db = context.env?.DOWNLOAD_COUNTS;
  if (!db) return;
  const day = new Date().toISOString().slice(0, 10);
  const tally = db.prepare(
    'INSERT INTO download_counts (day, product, version, count) VALUES (?1, ?2, ?3, 1) '
      + 'ON CONFLICT (day, product, version) DO UPDATE SET count = count + 1',
  ).bind(day, product, version).run().catch(() => {});
  context.waitUntil?.(tally);
}
