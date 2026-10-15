// Where a visitor came from, by the link they followed: ?ref=<source>. Only these names are counted, so a stray or
// invented ref adds nothing. Add a name here before using it on a post, a video or an email.
export const FUNNEL_SOURCES = Object.freeze([
  'send-to-mac',
  'instagram',
  'youtube',
  'reviewer',
  'newsletter',
]);

// The funnel's steps, in order.
export const FUNNEL_STEPS = Object.freeze(['link-sent', 'page-visit', 'manager-download']);

export const SEND_TO_MAC_SOURCE = 'send-to-mac';

/// The allowlisted source a URL carries, or '' when it carries none we count.
export function funnelSource(value) {
  const source = String(value ?? '').trim().toLowerCase();
  return FUNNEL_SOURCES.includes(source) ? source : '';
}

/// A site path with `ref=<source>` added (keeping any query it already has).
export function withSource(path, source) {
  if (!funnelSource(source)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}ref=${source}`;
}
