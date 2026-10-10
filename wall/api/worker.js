/* Latent Wall's own service: who an artist is (an email; a link to sign in), their site kept on the server with its
   pictures, and Publish putting the files where the world sees them. One Worker beside the static files; D1 for the
   rows, R2 for the bytes (the same bucket the sites are served from: a site's files live under its label, an
   account's pictures under `_accounts/`, a prefix no label can have).
   Nothing here is clever: every route checks the session, every write checks the owner, every delete is real. */
const DAY = 86400, SESSION_DAYS = 60, LINK_MINUTES = 20, MAX_DOC = 4e6, MAX_UPLOAD = 420 * 1024 * 1024;
// names no artist may take: the studio's own words and the addresses of its other services. The real guard is attach(),
// which asks Cloudflare who holds an address before touching it; this list only saves an artist the wait.
const RESERVED = new Set(["www", "api", "wall", "app", "latent", "admin", "mail", "ftp", "test", "sites", "static", "assets", "help", "support", "beta", "hello", "studio", "studios", "accounts", "the-wall",
  "license", "license-qa", "field", "join", "community", "versos", "nera", "moment", "ritual", "lab", "shop", "checkout", "send", "rsend"]);

const json = (d, status = 200, headers = {}) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const bad = (m, status = 400) => json({ error: m }, status);
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const token = () => hex(crypto.getRandomValues(new Uint8Array(24)));
const now = () => Math.floor(Date.now() / 1000), iso = () => new Date().toISOString();
const okEmail = (e) => typeof e === "string" && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const okId = (s) => typeof s === "string" && /^[a-z0-9-]{8,40}$/.test(s);
const okLabel = (n) => typeof n === "string" && /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(n) && !RESERVED.has(n);
const cookies = (req) => Object.fromEntries((req.headers.get("cookie") || "").split(";").map((c) => c.trim().split("=").map(decodeURIComponent)).filter((c) => c[0]));
const setSession = (url, s, days) => `wall_s=${s}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * DAY}${url.protocol === "https:" ? "; Secure" : ""}`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    let p; try { p = decodeURIComponent(url.pathname.slice(5)).replace(/\/$/, ""); } catch { return bad("Not a path."); }
    try { return await route(req, env, url, p); }
    catch (e) { console.error(e); return bad(`Something went wrong on our side: ${e.message || e}`, 500); }
  },
};

async function route(req, env, url, p) {
  const me = await session(req, env);
  // ---- the door: an email and, the first time, an invite key; a link is sent; the link makes a session
  if (p === "signin" && req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const email = String(b.email || "").trim().toLowerCase(), key = String(b.key || "").trim().toLowerCase();
    if (!okEmail(email)) return bad("That does not look like an email address.");
    const known = await env.DB.prepare("SELECT email FROM accounts WHERE email = ?").bind(email).first();
    let invite = null;
    if (!known) {
      if (!key) return json({ error: "Wall is by invite for now: the first time, your key goes here too.", needKey: true }, 403);
      invite = await env.DB.prepare("SELECT hash, used_by FROM invites WHERE hash = ?").bind(await sha(key)).first();
      if (!invite) return json({ error: "That key is not one we know. Keys are short phrases like silk-peony-1234; check for a missed letter.", needKey: true }, 403);
      if (invite.used_by && invite.used_by !== email) return json({ error: "That key has already been used by someone else.", needKey: true }, 403);
    }
    const t = token();
    await env.DB.prepare("INSERT INTO logins (hash, email, expires) VALUES (?, ?, ?)").bind(await sha(t), email, now() + LINK_MINUTES * 60).run();
    if (invite) await env.DB.prepare("UPDATE invites SET used_by = ? WHERE hash = ?").bind(email, invite.hash).run();
    // the link in the mail is absolute, at the public address. Until there is a mail service (the RESEND_KEY secret),
    // the link is handed back to the door instead, relative, so Wall can be tried; once the key is set, mail alone carries it.
    const sent = await sendLink(env, email, `${env.PUBLIC_ORIGIN || url.origin}/api/sign?t=${t}`);
    return json({ ok: true, sent, ...(env.RESEND_KEY ? {} : { link: `/api/sign?t=${t}` }) });
  }
  if (p === "sign" && req.method === "GET") {
    const t = url.searchParams.get("t") || "", h = await sha(t);
    const row = await env.DB.prepare("SELECT email, expires, used FROM logins WHERE hash = ?").bind(h).first();
    if (!row || row.used || row.expires < now()) return html(page("This link has been used already, or it has expired. Ask for a new one from Wall.", url.origin), 410);
    await env.DB.batch([
      env.DB.prepare("UPDATE logins SET used = 1 WHERE hash = ?").bind(h),
      env.DB.prepare("INSERT OR IGNORE INTO accounts (email, created) VALUES (?, ?)").bind(row.email, iso()),
      env.DB.prepare("DELETE FROM logins WHERE expires < ?").bind(now()),
    ]);
    const s = token();
    await env.DB.prepare("INSERT INTO sessions (hash, email, expires, made) VALUES (?, ?, ?, ?)").bind(await sha(s), row.email, now() + SESSION_DAYS * DAY, iso()).run();
    return new Response(null, { status: 302, headers: { location: "/app/", "set-cookie": setSession(url, s, SESSION_DAYS) } });
  }
  if (p === "signout" && req.method === "POST") {
    const c = cookies(req); if (c.wall_s) await env.DB.prepare("DELETE FROM sessions WHERE hash = ?").bind(await sha(c.wall_s)).run();
    return json({ ok: true }, 200, { "set-cookie": setSession(url, "", 0) });
  }
  // ---- who am I, and my sites
  if (p === "me" && req.method === "GET") {
    if (!me) return json({ signedIn: false });
    const sites = (await env.DB.prepare("SELECT id, label, revision, updated, published FROM sites WHERE email = ? ORDER BY updated DESC").bind(me).all()).results;
    return json({ signedIn: true, email: me, sites, domain: env.SITE_DOMAIN });
  }
  if (p === "me" && req.method === "DELETE") {
    if (!me) return bad("Not signed in.", 401);
    const b = await req.json().catch(() => ({})); if (b.confirm !== "DELETE") return bad("Type DELETE to confirm.");
    const sites = (await env.DB.prepare("SELECT id, label FROM sites WHERE email = ?").bind(me).all()).results;
    for (const s of sites) if (s.label) { await wipe(env, `${s.label}/`); await detach(env, s.label); }
    await wipe(env, `_accounts/${await sha(me)}/`);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sites WHERE email = ?").bind(me), env.DB.prepare("DELETE FROM sessions WHERE email = ?").bind(me),
      env.DB.prepare("DELETE FROM logins WHERE email = ?").bind(me), env.DB.prepare("UPDATE invites SET used_by = NULL WHERE used_by = ?").bind(me),
      env.DB.prepare("DELETE FROM accounts WHERE email = ?").bind(me),
    ]);
    return json({ ok: true, removed: sites.map((s) => s.label).filter(Boolean) }, 200, { "set-cookie": setSession(url, "", 0) });
  }
  if (!me) return bad("Not signed in.", 401);
  const acct = `_accounts/${await sha(me)}`;
  let m;
  // ---- the site document, kept with a revision so two devices never overwrite each other blindly
  if ((m = p.match(/^site\/([a-z0-9-]+)$/))) {
    const id = m[1]; if (!okId(id)) return bad("Not a site id.");
    const row = await env.DB.prepare("SELECT email, label, document, revision, updated, published FROM sites WHERE id = ?").bind(id).first();
    if (row && row.email !== me) return bad("That site belongs to someone else.", 403);
    if (req.method === "GET") { if (!row) return bad("No such site of yours.", 404); return json({ site: JSON.parse(row.document), revision: row.revision, label: row.label, updated: row.updated, published: row.published }); }
    if (req.method === "PUT") {
      const b = await req.json().catch(() => null); if (!b || !b.site || typeof b.basedOn !== "number") return bad("A site and the revision it is based on.");
      const doc = JSON.stringify(b.site); if (doc.length > MAX_DOC) return bad("The site is too large to keep.");
      if (row && row.revision !== b.basedOn) return json({ error: "stale", revision: row.revision, site: JSON.parse(row.document) }, 409);
      const rev = (row ? row.revision : 0) + 1;
      await env.DB.prepare("INSERT INTO sites (id, email, document, revision, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document, revision = excluded.revision, updated = excluded.updated").bind(id, me, doc, rev, iso()).run();
      return json({ revision: rev });
    }
    if (req.method === "DELETE") { if (!row) return bad("No such site of yours.", 404); if (row.label) { await wipe(env, `${row.label}/`); await detach(env, row.label); } await env.DB.prepare("DELETE FROM sites WHERE id = ?").bind(id).run(); return json({ ok: true }); }
  }
  // ---- the pictures and films: bytes under the account, by the app's own asset id
  if ((m = p.match(/^asset\/(asset:[A-Za-z0-9_-]{4,80})$/))) {
    const key = `${acct}/${m[1]}`;
    if (req.method === "PUT") {
      const len = +(req.headers.get("content-length") || 0); if (len > MAX_UPLOAD) return bad("Too large.", 413);
      await env.SITES.put(key, req.body, { httpMetadata: { contentType: req.headers.get("content-type") || "application/octet-stream" } }); return json({ ok: true });
    }
    if (req.method === "GET") { const o = await env.SITES.get(key); if (!o) return bad("No such picture.", 404); return new Response(o.body, { headers: { "content-type": o.httpMetadata?.contentType || "application/octet-stream", "cache-control": "private, max-age=31536000, immutable", etag: o.httpEtag } }); }
    if (req.method === "HEAD") { const o = await env.SITES.head(key); return new Response(null, { status: o ? 200 : 404 }); }
    if (req.method === "DELETE") { await env.SITES.delete(key); return json({ ok: true }); }
  }
  // ---- publish: begin claims the address, the files go up one by one, done names them all and lets go of the rest
  if ((m = p.match(/^publish\/([a-z0-9-]+)(?:\/(.*))?$/))) {
    const id = m[1], rest = m[2] || "";
    const row = await env.DB.prepare("SELECT email, label FROM sites WHERE id = ?").bind(id).first();
    if (!row || row.email !== me) return bad("Not your site. Save it first, then publish.", 403);
    if (rest === "begin" && req.method === "POST") {
      const b = await req.json().catch(() => ({})), label = String(b.label || "").toLowerCase();
      if (!okLabel(label)) return bad(`“${label}” cannot be an address. Letters, numbers and hyphens, from your name.`);
      const taken = await env.DB.prepare("SELECT id FROM sites WHERE label = ? AND id != ?").bind(label, id).first();
      if (taken) return json({ error: `${label}.${env.SITE_DOMAIN} is someone else's address. Change your name in Edit → The site, and it changes with it.`, taken: true }, 409);
      const held = await attach(env, label);
      if (held === "taken") return json({ error: `${label}.${env.SITE_DOMAIN} belongs to another Latent service. Change your name in Edit → The site, and the address changes with it.`, taken: true }, 409);
      if (row.label && row.label !== label) { await wipe(env, `${row.label}/`); await detach(env, row.label); }
      await env.DB.prepare("UPDATE sites SET label = ? WHERE id = ?").bind(label, id).run();
      return json({ ok: true, label, fresh: held === "new" });
    }
    if (!row.label) return bad("Begin the publish first.");
    if (rest === "done" && req.method === "POST") {
      const b = await req.json().catch(() => ({})), files = Array.isArray(b.files) ? b.files.filter((f) => typeof f === "string") : [];
      const old = await env.SITES.get(`${row.label}/.manifest.json`), had = old ? ((await old.json()).files || []) : [];
      const keep = new Set(files), gone = had.filter((k) => !keep.has(k)); if (gone.length) await env.SITES.delete(gone.map((k) => `${row.label}/${k}`));
      await env.SITES.put(`${row.label}/.manifest.json`, JSON.stringify({ files, at: iso() }), { httpMetadata: { contentType: "application/json" } });
      await env.DB.prepare("UPDATE sites SET published = ? WHERE id = ?").bind(iso(), id).run();
      return json({ ok: true, address: `https://${row.label}.${env.SITE_DOMAIN}/` });
    }
    if (rest && !rest.includes("..") && rest.length <= 300 && req.method === "PUT") {
      if (rest === ".manifest.json") return bad("Not a file of a site.");
      await env.SITES.put(`${row.label}/${rest}`, req.body, { httpMetadata: { contentType: req.headers.get("content-type") || "application/octet-stream" } });
      return json({ ok: true });
    }
  }
  return bad("No such thing.", 404);
}

async function session(req, env) {
  const c = cookies(req); if (!c.wall_s) return null;
  const row = await env.DB.prepare("SELECT email, expires FROM sessions WHERE hash = ?").bind(await sha(c.wall_s)).first();
  return row && row.expires > now() ? row.email : null;
}
async function wipe(env, prefix) {
  let cursor; do { const l = await env.SITES.list({ prefix, cursor }); if (l.objects.length) await env.SITES.delete(l.objects.map((o) => o.key)); cursor = l.truncated ? l.cursor : undefined; } while (cursor);
}
/* ---- addresses. Every service of the studio keeps its own address and nothing reaches into another's: there is no
   catch-all. A published site gets exactly one address, name.latentstudios.art, attached to the sites Worker alone.
   Before attaching, Wall asks Cloudflare who holds that name, and refuses if anyone else does (a Worker or any DNS
   record). It lets go only of addresses that point at the sites Worker. CF_TOKEN may attach Workers to addresses and
   read the zone's records; it is set once as a secret. */
const CF = "https://api.cloudflare.com/client/v4";
async function cf(env, path, init = {}) {
  const r = await fetch(`${CF}${path}`, { ...init, headers: { authorization: `Bearer ${env.CF_TOKEN}`, "content-type": "application/json" } });
  const d = await r.json().catch(() => ({}));
  if (!d.success) throw new Error(`the address could not be made (${(d.errors || []).map((e) => e.message).join("; ") || r.status})`);
  return d.result;
}
const holders = async (env, host) => (await cf(env, `/accounts/${env.CF_ACCOUNT}/workers/domains?hostname=${encodeURIComponent(host)}`)).filter((d) => d.hostname === host);
/** "ok" (already ours), "new" (attached just now) or "taken" (someone else's). */
async function attach(env, label) {
  if (!env.CF_TOKEN) throw new Error("addresses cannot be made yet: the service is missing its Cloudflare key");
  const host = `${label}.${env.SITE_DOMAIN}`, held = await holders(env, host);
  if (held.length) return held.every((d) => d.service === env.SITES_SERVICE) ? "ok" : "taken";
  if ((await cf(env, `/zones/${env.CF_ZONE}/dns_records?name=${encodeURIComponent(host)}`)).length) return "taken";
  await cf(env, `/accounts/${env.CF_ACCOUNT}/workers/domains`, { method: "PUT", body: JSON.stringify({ hostname: host, service: env.SITES_SERVICE, zone_id: env.CF_ZONE }) });
  return "new";
}
async function detach(env, label) {
  if (!env.CF_TOKEN) return;
  for (const d of await holders(env, `${label}.${env.SITE_DOMAIN}`)) if (d.service === env.SITES_SERVICE) await cf(env, `/accounts/${env.CF_ACCOUNT}/workers/domains/${d.id}`, { method: "DELETE" });
}
async function sendLink(env, email, link) {
  if (!env.RESEND_KEY) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${env.RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Latent Wall <wall@latentstudios.art>", to: [email], subject: "Your way into Latent Wall",
      text: `Here is your link to sign in to Latent Wall. It works once, for ${LINK_MINUTES} minutes.\n\n${link}\n\nIf you did not ask for this, ignore it; nothing happens without the link.`,
      html: `<p style="font:16px/1.6 Georgia,serif;color:#29222A">Here is your link to sign in to Latent Wall. It works once, for ${LINK_MINUTES} minutes.</p><p><a href="${link}" style="font:16px Georgia,serif;color:#29222A">Sign in to Latent Wall &rarr;</a></p><p style="font:13px/1.5 Georgia,serif;color:#6B5F66">If you did not ask for this, ignore it; nothing happens without the link.</p>`,
    }),
  });
  if (!r.ok) console.error("mail refused", r.status, await r.text().catch(() => ""));
  return r.ok;
}
const html = (body, status) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const page = (text, origin) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Latent Wall</title><body style="margin:0;background:#EEE9E7;color:#29222A;font:300 19px/1.6 Georgia,serif"><main style="max-width:560px;margin:0 auto;padding:18vh 24px"><p style="font:11px/1 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase">Latent Wall<span style="color:#A0697A">.</span></p><p>${text}</p><p><a href="${origin}/app/" style="color:inherit">Back to Wall</a></p></main>`;
