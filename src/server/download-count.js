// The download counter: one anonymous tally per day, product and version (db/download-counts.sql).
// A download counts once, on the request that starts at the first byte -- Manager fetches a package in
// pieces, and HEAD probes and later pieces are not new downloads. No address, browser or account is kept,
// and the tally never delays or fails the download itself.
export function countDownload(context, product, version, range) {
  const db = context.env?.DOWNLOAD_COUNTS;
  if (!db || context.request.method !== 'GET' || (range && range.offset !== 0)) return;
  const day = new Date().toISOString().slice(0, 10);
  const tally = db.prepare(
    'INSERT INTO download_counts (day, product, version, count) VALUES (?1, ?2, ?3, 1) '
      + 'ON CONFLICT (day, product, version) DO UPDATE SET count = count + 1',
  ).bind(day, product, version).run().catch(() => {});
  context.waitUntil?.(tally);
}
