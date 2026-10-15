import { siteOrigin, websiteAliases } from '../src/config/site.js';
import { funnelSource } from '../src/config/funnel.js';
import { countStep } from '../src/server/funnel-count.js';

// One routing owner for static pages and Functions, including invitation and
// download URLs. 308 preserves methods/bodies; URL preserves paths and queries.
export const onRequest = (context) => {
  const { request, next } = context;
  const url = new URL(request.url);
  const isAlias = websiteAliases.has(url.hostname);
  const isOldLabPath = url.pathname === '/resolve' || url.pathname === '/resolve/';

  if (!isAlias && !isOldLabPath) {
    // A page opened from a link we count (?ref=<source>): one tally, numbers only. Downloads count themselves.
    if (request.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/download/')
      && funnelSource(url.searchParams.get('ref'))) {
      countStep(context, 'page-visit', url.searchParams.get('ref'));
    }
    return next();
  }

  if (isAlias) {
    const canonical = new URL(siteOrigin);
    url.protocol = canonical.protocol;
    url.host = canonical.host;
  }
  if (isOldLabPath) url.pathname = '/lab';
  return Response.redirect(url.href, 308);
};
