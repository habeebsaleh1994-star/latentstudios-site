// Carries the link's ?ref= (when it is one we count) to this visit's Manager download links, so a download started
// from a post, a video or the send-to-Mac email is counted under that source. Nothing is stored beyond this tab.
import { funnelSource, withSource } from '../config/funnel.js';

let source = funnelSource(new URLSearchParams(location.search).get('ref'));
try {
  if (source) sessionStorage.setItem('latent-ref', source);
  else source = funnelSource(sessionStorage.getItem('latent-ref'));
} catch { /* private mode: this page's links still carry it */ }

if (source) {
  for (const link of document.querySelectorAll('a[href^="/download/manager"]')) {
    const href = link.getAttribute('href');
    if (!/[?&]ref=/u.test(href)) link.setAttribute('href', withSource(href, source));
  }
}
