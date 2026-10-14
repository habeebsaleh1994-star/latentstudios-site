// Cloudflare Pages Function — POST /api/send-to-mac
// One email with the purchase link, for a visitor who is not on a Mac. The work lives in
// src/server/send-to-mac.js; this wires the opt-in Letters subscription to the existing /api/subscribe.
import { handleSendToMac } from '../../src/server/send-to-mac.js';
import { onRequestPost as subscribe } from './subscribe.js';

export const onRequestPost = (context) => handleSendToMac(context, {
  async subscribe(email) {
    const request = new Request(new URL('/api/subscribe', context.request.url), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'CF-Connecting-IP': context.request.headers.get('CF-Connecting-IP') || '',
        Referer: context.request.headers.get('Referer') || '',
      },
      body: JSON.stringify({ email, tag: 'send-to-mac' }),
    });
    const res = await subscribe({ request, env: context.env });
    return res.ok;
  },
});
