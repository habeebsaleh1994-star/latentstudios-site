// The funnel counter: one anonymous tally per day, step and source (db/funnel-counts.sql), in the same database as
// the download counts. It never delays or fails the request it counts.
import { FUNNEL_STEPS, funnelSource } from '../config/funnel.js';

export function countStep(context, step, source) {
  const db = context?.env?.DOWNLOAD_COUNTS;
  const counted = funnelSource(source);
  if (!db || !counted || !FUNNEL_STEPS.includes(step)) return;
  const day = new Date().toISOString().slice(0, 10);
  const tally = db.prepare(
    'INSERT INTO funnel_counts (day, step, source, count) VALUES (?1, ?2, ?3, 1) '
      + 'ON CONFLICT (day, step, source) DO UPDATE SET count = count + 1',
  ).bind(day, step, counted).run().catch(() => {});
  context.waitUntil?.(tally);
}
