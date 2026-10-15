// "Send it to my Mac" (2026-10-14): a visitor on a phone (or a Windows/Linux desktop) leaves an address and
// receives one email with the purchase link, to open on the Mac where The Ritual runs.
//
// Nothing about the person is kept: the address is used for this one email and, only if they ticked
// "Also send me Letters from the studio", handed to the existing /api/subscribe path. It never appears in a
// URL or a log line. Rate limits count salted SHA-256 digests of the IP and the address in Cloudflare's
// cache (per data centre, expiring on their own), not the values themselves.
//
// The mailer is one small interface, `send({ to, from, subject, text, html })`, chosen from the environment:
//   1. SEND_EMAIL — a Cloudflare Email Service binding (`env.SEND_EMAIL.send({...})`), sender domain onboarded.
//   2. RESEND_API_KEY — Resend's HTTP API, for when the binding is not available to Pages Functions.
// Without either the endpoint answers 503 `not_configured`, and the page offers "Copy the link" honestly.

import { siteOrigin } from '../config/site.js';
import { ritualPlan, ritualPlanSummary, ritualPurchasePath } from '../config/ritual-commerce.js';
import { SEND_TO_MAC_SOURCE, withSource } from '../config/funnel.js';
import { countStep } from './funnel-count.js';

export const EMAIL_RE = /^[^\s@<>()",;]{1,64}@[^\s@<>()",;]{1,253}\.[^\s@<>()",;.]{2,63}$/u;
export const REPLY_TO = 'ritual@latentstudios.art';
export const DEFAULT_FROM = 'The Ritual <ritual@mail.latentstudios.art>';   // the sending domain onboarded on Cloudflare Email Service
export const LIMITS = Object.freeze({
  ip: { max: 6, seconds: 3600 },
  address: { max: 2, seconds: 3600 },
});

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export function chooseMailer(env, fetcher = fetch) {
  const from = env.SEND_FROM || DEFAULT_FROM;
  if (env.SEND_EMAIL && typeof env.SEND_EMAIL.send === 'function') {
    const named = /^(.*?)\s*<([^>]+)>$/u.exec(from);
    return {
      name: 'cloudflare',
      from,
      send: (message) => env.SEND_EMAIL.send({
        ...message,
        from: named ? { name: named[1], email: named[2] } : from,
      }),
    };
  }
  if (env.RESEND_API_KEY) {
    return {
      name: 'resend',
      from,
      async send({ to, from: sender, replyTo, subject, text, html }) {
        const res = await fetcher('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: sender, to: [to], reply_to: replyTo, subject, text, html }),
        });
        if (!res.ok) throw new Error(`mailer_status_${res.status}`);
      },
    };
  }
  return null;
}

// The link carries ?ref=send-to-mac, so its visit and the download it starts are counted under the email.
export function purchaseLink(planId) {
  return `${siteOrigin}${withSource(ritualPurchasePath(planId), SEND_TO_MAC_SOURCE)}`;
}

const STEPS = [
  ['Download Latent Manager.', 'Open Latent Manager.dmg, drag it to Applications, and open it.'],
  ['Sign in to your Latent account', 'with Apple or Google. Manager keeps your plan, your Macs and your updates together.'],
  ['Install The Ritual', 'from Manager, and open it.'],
  ['Use it free, with the Latent mark.', 'Choose a plan whenever you are ready; Paddle handles the secure checkout.'],
];

const escapeHTML = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function composeEmail(planId) {
  const link = purchaseLink(planId);
  const plan = ritualPlan(planId);
  const chosen = plan ? `Latent Manager opens on ${ritualPlanSummary(plan)}. You choose and pay there, when you’re ready.` : '';
  const subject = 'The Ritual, for your Mac';
  const text = [
    'Open this on your Mac:',
    link,
    '',
    ...(chosen ? [chosen, ''] : []),
    'Four steps:',
    ...STEPS.map(([a, b], i) => `${i + 1}. ${a} ${b}`),
    '',
    'The Ritual runs on macOS 26 with Apple silicon.',
    '',
    'Questions? Reply to ritual@latentstudios.art.',
    'Latent Studios',
    '',
    'You received this because someone asked latentstudios.art to send this link to this address. Nothing else will follow.',
  ].join('\n');
  const ink = '#E8DDD0', soft = '#a99a8a', amber = '#E8C4A0', ground = '#1A1614', hair = 'rgba(212,196,176,0.18)';
  const serif = "'Cormorant Garamond', Cormorant, Georgia, 'Times New Roman', serif";
  const sans = "'Instrument Sans', -apple-system, 'Helvetica Neue', Arial, sans-serif";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${ground};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ground};"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="font-family:${sans};font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a682;padding-bottom:18px;">The Ritual &middot; for Mac</td></tr>
<tr><td style="font-family:${serif};font-size:34px;line-height:1.1;color:${ink};padding-bottom:16px;">Open this on your Mac.</td></tr>
${chosen ? `<tr><td style="font-family:${serif};font-size:19px;line-height:1.45;color:${ink};padding-bottom:12px;">${escapeHTML(chosen)}</td></tr>` : ''}
<tr><td style="padding:8px 0 30px;"><a href="${link}" style="font-family:${serif};font-style:italic;font-size:26px;color:${amber};text-decoration:none;">Get The Ritual for Mac &rarr;</a><br><span style="font-family:${sans};font-size:12px;color:${soft};">${link}</span></td></tr>
<tr><td style="border-top:1px solid ${hair};padding-top:22px;font-family:${sans};font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c9a682;padding-bottom:10px;">Four steps</td></tr>
${STEPS.map(([a, b], i) => `<tr><td style="font-family:${serif};font-size:17px;line-height:1.5;color:${soft};padding:6px 0;">${i + 1}.&nbsp; <strong style="font-weight:600;color:${ink};">${escapeHTML(a)}</strong> ${escapeHTML(b)}</td></tr>`).join('\n')}
<tr><td style="font-family:${sans};font-size:12px;line-height:1.6;color:${soft};padding-top:26px;">The Ritual runs on macOS 26 with Apple silicon. Questions? Write to ritual@latentstudios.art.</td></tr>
<tr><td style="font-family:${sans};font-size:11px;line-height:1.6;color:#6f6458;padding-top:18px;">Someone asked latentstudios.art to send this link to this address. Nothing else will follow.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html, link };
}

async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Counts in Cloudflare's cache: one small entry per digest, expiring after its window.
export function cacheLimiter(cache, origin) {
  return async (kind, value, { max, seconds }) => {
    if (!cache) return true;
    const key = new Request(`${origin}/__send-to-mac-limit/${kind}/${await digest(`latent-send-to-mac:${kind}:${value}`)}`);
    const prior = await cache.match(key);
    const count = prior ? Number(await prior.text()) || 0 : 0;
    if (count >= max) return false;
    await cache.put(key, new Response(String(count + 1), { headers: { 'cache-control': `max-age=${seconds}` } }));
    return true;
  };
}

async function readBody(request) {
  try {
    if ((request.headers.get('content-type') || '').includes('application/json')) return await request.json();
    return Object.fromEntries(await request.formData());
  } catch {
    return {};
  }
}

export async function handleSendToMac({ request, env = {}, waitUntil }, deps = {}) {
  const data = await readBody(request);
  const email = String(data.email || '').trim();
  const planId = ritualPlan(String(data.plan || '')) ? String(data.plan) : '';
  const letters = data.letters === true || data.letters === '1' || data.letters === 'on' || data.letters === 'true';

  if (String(data.website || '').trim() !== '') return json({ ok: true });
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);

  const limit = deps.limit
    ?? cacheLimiter(typeof caches !== 'undefined' ? caches.default : null, new URL(request.url).origin);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await limit('ip', ip, LIMITS.ip)) || !(await limit('address', email.toLowerCase(), LIMITS.address))) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  // Letters only when asked for, through the one newsletter path the rest of the site uses.
  let subscribed = false;
  if (letters && deps.subscribe) {
    try { subscribed = await deps.subscribe(email); } catch { subscribed = false; }
  }

  const mailer = deps.mailer === undefined ? chooseMailer(env) : deps.mailer;
  if (!mailer) return json({ ok: false, error: 'not_configured', subscribed }, 503);

  const message = composeEmail(planId);
  try {
    // Replies reach a real inbox: the sending subdomain has none, The Ritual's address does.
    await mailer.send({ to: email, from: mailer.from, replyTo: REPLY_TO, subject: message.subject, text: message.text, html: message.html });
  } catch (error) {
    // The reason only; never the address.
    console.error('send-to-mac: mailer failed', mailer.name, error instanceof Error ? error.message : 'unknown');
    return json({ ok: false, error: 'send_failed', subscribed }, 502);
  }
  countStep({ env, waitUntil }, 'link-sent', SEND_TO_MAC_SOURCE);
  return json({ ok: true, subscribed });
}
