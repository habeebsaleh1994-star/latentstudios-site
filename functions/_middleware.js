import { siteOrigin, websiteAliases } from '../src/config/site.js';

// One routing owner for static pages and Functions, including invitation and
// download URLs. 308 preserves methods/bodies; URL preserves paths and queries.
export const onRequest = ({ request, next }) => {
  const url = new URL(request.url);
  const isAlias = websiteAliases.has(url.hostname);
  const isOldLabPath = url.pathname === '/resolve' || url.pathname === '/resolve/';

  if (!isAlias && !isOldLabPath) return next();

  if (isAlias) {
    const canonical = new URL(siteOrigin);
    url.protocol = canonical.protocol;
    url.host = canonical.host;
  }
  if (isOldLabPath) url.pathname = '/lab';
  return Response.redirect(url.href, 308);
};
