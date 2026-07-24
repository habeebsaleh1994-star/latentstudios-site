// Cloudflare Pages Function — POST /api/subscribe
//
// Signups go through here instead of posting straight to Buttondown's public
// embed form. That public endpoint is gated by Buttondown's firewall / Cloudflare
// Turnstile ("Verify your subscription"), which silently rejects our custom form
// with HTTP 400 — so nobody was ever added, while the page falsely showed success.
// Buttondown's authenticated API (below) is NOT behind that gate. The API key
// lives only in the BUTTONDOWN_API_KEY environment variable (Pages → Settings →
// Environment variables) and is never exposed to the browser.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const onRequestPost = async ({ request, env }) => {
  // Accept a JSON body (the enhanced form) or form-encoded (no-JS fallback).
  let data = {};
  try {
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      data = await request.json();
    } else {
      data = Object.fromEntries(await request.formData());
    }
  } catch {
    /* leave data empty → fails the email check below */
  }

  const email = String(data.email || "").trim();
  const tag = String(data.tag || "").trim();

  // Honeypot: a hidden field real people never fill. Pretend success, drop it.
  if (String(data.website || "").trim() !== "") return json({ ok: true });

  // The production secret is stored under the name "Latent" (Cloudflare does
  // not allow renaming a secret, so we accept it under either name).
  const apiKey = env.BUTTONDOWN_API_KEY || env.Latent;

  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "invalid_email" }, 400);
  if (!apiKey) return json({ ok: false, error: "not_configured" }, 500);

  let res;
  try {
    res = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        // "regular" = added immediately, no confirmation email. Remove this line
        // to switch to Buttondown's double opt-in (subscriber must click to confirm).
        type: "regular",
        tags: tag ? [tag] : [],
        referrer_url: request.headers.get("Referer") || undefined,
        ip_address: request.headers.get("CF-Connecting-IP") || undefined,
      }),
    });
  } catch {
    return json({ ok: false, error: "upstream_unreachable" }, 502);
  }

  if (res.ok) return json({ ok: true, created: true });

  const status = res.status;
  const body = await res.text();
  let code = "";
  try { code = JSON.parse(body).code || ""; } catch { /* non-JSON body */ }

  // Already on the list → Buttondown returns 400 with code "email_already_exists".
  // Match on the explicit code (not a loose word) so real failures aren't masked.
  if (status === 400 && (code === "email_already_exists" || /already (exists|subscribed)/i.test(body))) {
    return json({ ok: true, already: true });
  }

  // Any other non-2xx is a genuine failure — surface Buttondown's own reason so
  // it can never silently look like success again.
  return json({ ok: false, error: "buttondown_error", status, code, detail: body.slice(0, 300) }, 502);
};
