// The morning letter: yesterday at Latent Studios, in numbers. It reads only counts and totals -- the site's anonymous
// tallies, how many accounts were made, which plans were bought and what they earned -- and nothing of any person.
export const DIGEST_FROM = { name: 'Latent Studios', email: 'digest@mail.latentstudios.art' };

const money = (minor, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(minor || 0) / 100);
const percent = (part, whole) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');
const PRODUCT = { 'latent-ritual': 'The Ritual', 'latent-print-engine': 'Print Engine' };

/// The UTC day before `now`, as YYYY-MM-DD.
export function previousDay(now = new Date()) {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results ?? [];
const one = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).first()) ?? {};

/// The owner's own test accounts (secret DIGEST_EXCLUDE_ACCOUNTS, comma-separated account ids): their purchases are
/// tests, never sales, so no count or total includes them.
export function excludedAccounts(env) {
  return String(env.DIGEST_EXCLUDE_ACCOUNTS ?? '').split(',').map((id) => id.trim())
    .filter((id) => /^[0-9a-f-]{36}$/u.test(id));
}

export async function gatherDigest(env, day) {
  // Sales are plans still standing: a refund or chargeback since (status revoked) is no sale, and the owner's own
  // test accounts are left out. Earnings follow the same plans; a renewal (no plan of its own) counts as earned.
  const skip = excludedAccounts(env);
  const notSkipped = skip.length ? `AND account_id NOT IN (${skip.map((_, i) => `?${i + 2}`).join(', ')})` : '';
  const notSkippedAll = skip.length ? `AND account_id NOT IN (${skip.map((_, i) => `?${i + 1}`).join(', ')})` : '';
  const [funnel, downloads, accounts, accountsTotal, plans, earnings, active, refunds, fwDownloads, fwPaid] = await Promise.all([
    all(env.COUNTS, 'SELECT step, source, SUM(count) AS n FROM funnel_counts WHERE day = ?1 GROUP BY step, source', day),
    one(env.COUNTS, "SELECT COALESCE(SUM(count), 0) AS n FROM download_counts WHERE day = ?1 AND product = 'latent-manager'", day),
    one(env.ACCOUNTS, 'SELECT COUNT(*) AS n FROM accounts WHERE substr(created_at, 1, 10) = ?1 AND deleted_at IS NULL', day),
    one(env.ACCOUNTS, 'SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL'),
    all(env.LICENSING, `SELECT product_id AS product, plan, COUNT(*) AS n FROM commercial_entitlements
      WHERE access_basis = 'paid' AND status = 'active' AND purchase_reversed_at IS NULL
        AND substr(created_at, 1, 10) = ?1 ${notSkipped} GROUP BY product_id, plan`, day, ...skip),
    one(env.LICENSING, `SELECT COALESCE(SUM(earnings_minor), 0) AS minor FROM sale_notices
      WHERE substr(occurred_at, 1, 10) = ?1 AND earnings_currency = 'USD'
        AND transaction_id NOT IN (SELECT transaction_id FROM firmware_supporters WHERE refunded_at IS NOT NULL)
        AND transaction_id NOT IN (SELECT paddle_transaction_id FROM commercial_entitlements
          WHERE paddle_transaction_id IS NOT NULL AND (status <> 'active' OR purchase_reversed_at IS NOT NULL
            ${skip.length ? `OR account_id IN (${skip.map((_, i) => `?${i + 2}`).join(', ')})` : ''}))`, day, ...skip),
    all(env.LICENSING, `SELECT product_id AS product, tier, COUNT(*) AS n FROM commercial_entitlements
      WHERE access_basis = 'paid' AND status = 'active' ${notSkippedAll} GROUP BY product_id, tier`, ...skip),
    one(env.LICENSING, `SELECT COUNT(*) AS n FROM commercial_entitlements
      WHERE access_basis = 'paid' AND substr(purchase_reversed_at, 1, 10) = ?1 ${notSkipped}`, day, ...skip),
    // The Ritual, in the camera: downloads started and finished (download_counts, `<file>` and `<file>/finished`),
    // and what was paid (firmware_supporters, refunds left out), with what Stripe left us (sale_notices).
    all(env.COUNTS, `SELECT product, SUM(CASE WHEN day = ?1 THEN count ELSE 0 END) AS day_n, SUM(count) AS total_n
      FROM download_counts WHERE product LIKE 'the-ritual-5d/%' AND day <= ?1 GROUP BY product`, day),
    one(env.LICENSING, `SELECT COUNT(*) AS n, COALESCE(SUM(f.grand_total_minor), 0) AS minor,
        COALESCE(SUM(s.earnings_minor), 0) AS kept_minor,
        COALESCE(SUM(CASE WHEN substr(f.paid_at, 1, 10) = ?1 THEN 1 ELSE 0 END), 0) AS day_n,
        COALESCE(SUM(CASE WHEN substr(f.paid_at, 1, 10) = ?1 THEN f.grand_total_minor ELSE 0 END), 0) AS day_minor
      FROM firmware_supporters f LEFT JOIN sale_notices s ON s.transaction_id = f.transaction_id
      WHERE f.refunded_at IS NULL AND f.currency = 'USD' AND substr(f.paid_at, 1, 10) <= ?1`, day),
  ]);
  const step = (name, source) => funnel.filter((r) => r.step === name && (!source || r.source === source))
    .reduce((sum, r) => sum + Number(r.n), 0);
  const sources = [...new Set(funnel.map((r) => r.source))].filter((s) => s !== 'send-to-mac').sort().map((source) => ({
    source,
    visits: step('page-visit', source),
    downloads: step('manager-download', source),
  }));
  return {
    day,
    sendToMac: { sent: step('link-sent', 'send-to-mac'), opened: step('page-visit', 'send-to-mac'), downloads: step('manager-download', 'send-to-mac') },
    sources,
    managerDownloads: Number(downloads.n ?? 0),
    newAccounts: Number(accounts.n ?? 0),
    totalAccounts: Number(accountsTotal.n ?? 0),
    newPlans: plans.map((r) => ({ product: PRODUCT[r.product] ?? r.product, plan: r.plan ?? 'plan', n: Number(r.n) })),
    earningsMinor: Number(earnings.minor ?? 0),
    activePlans: active.map((r) => ({ product: PRODUCT[r.product] ?? r.product, tier: r.tier, n: Number(r.n) })),
    refunds: Number(refunds.n ?? 0),
    firmware: firmwareNumbers(fwDownloads, fwPaid),
  };
}

const FIRMWARE_FILES = { 'classic-mac': '5D Mac', 'classic-windows': '5D Windows', 'mark-ii-mac': '5D Mark II Mac', 'mark-ii-windows': '5D Mark II Windows' };

/// Started = a download that began at the first byte; finished = its last byte reached the person (whole or resumed).
export function firmwareNumbers(rows = [], paid = {}) {
  const count = (finished, field) => rows.filter((r) => String(r.product).endsWith('/finished') === finished)
    .reduce((sum, r) => sum + Number(r[field] ?? 0), 0);
  const files = Object.entries(FIRMWARE_FILES).map(([slug, name]) => ({
    name,
    finished: Number(rows.find((r) => r.product === `the-ritual-5d/${slug}/finished`)?.total_n ?? 0),
  }));
  return {
    day: { started: count(false, 'day_n'), finished: count(true, 'day_n'), paid: Number(paid.day_n ?? 0), minor: Number(paid.day_minor ?? 0) },
    total: { started: count(false, 'total_n'), finished: count(true, 'total_n'), paid: Number(paid.n ?? 0), minor: Number(paid.minor ?? 0), keptMinor: Number(paid.kept_minor ?? 0) },
    files,
  };
}

export function composeDigest(d) {
  const newPlans = d.newPlans.reduce((sum, p) => sum + p.n, 0);
  const activePaid = d.activePlans.reduce((sum, p) => sum + p.n, 0);
  const label = new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const subject = `Yesterday at Latent · ${d.newAccounts} new ${d.newAccounts === 1 ? 'account' : 'accounts'} · `
    + `${newPlans} ${newPlans === 1 ? 'sale' : 'sales'}${newPlans ? ` · ${money(d.earningsMinor)}` : ''}`;
  const lines = [
    `${label} (UTC)`,
    '',
    'THE FUNNEL',
    `Send to Mac: ${d.sendToMac.sent} sent · ${d.sendToMac.opened} opened (${percent(d.sendToMac.opened, d.sendToMac.sent)}) · ${d.sendToMac.downloads} downloaded Manager`,
    `Manager downloads: ${d.managerDownloads}`,
    `New accounts: ${d.newAccounts}`,
    `New plans: ${newPlans}${d.newPlans.length ? ` (${d.newPlans.map((p) => `${p.n} ${p.product} ${p.plan}`).join(', ')})` : ''}`,
    `Earned: ${money(d.earningsMinor)}`,
    ...(d.refunds ? [`Refunded or charged back: ${d.refunds}`] : []),
    '',
    ...(d.sources.length ? ['FROM YOUR LINKS', ...d.sources.map((s) => `${s.source}: ${s.visits} visits · ${s.downloads} downloads`), ''] : []),
    ...firmwareLines(d.firmware),
    'SO FAR',
    `Accounts: ${d.totalAccounts} · paying: ${activePaid} (${percent(activePaid, d.totalAccounts)})`,
    ...d.activePlans.map((p) => `  ${p.product} ${p.tier}: ${p.n}`),
    '',
    'Numbers only: nothing about any person is in this letter.',
    'Stripe: https://dashboard.stripe.com/payments',
  ];
  const text = lines.join('\n');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const quiet = (line) => line.startsWith('Numbers only') || line.startsWith('Stripe');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#1A1614;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1A1614;"><tr><td align="center" style="padding:36px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#E8DDD0;">
${lines.map((line) => {
    if (!line) return '<tr><td style="height:14px;"></td></tr>';
    if (/^[A-Z ]+$/u.test(line)) return `<tr><td style="font-size:11px;letter-spacing:0.2em;color:#c9a682;padding-top:6px;">${esc(line)}</td></tr>`;
    return `<tr><td style="font-size:15px;line-height:1.6;color:${quiet(line) ? '#6f6458' : '#E8DDD0'};">${esc(line)}</td></tr>`;
  }).join('\n')}
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

function firmwareLines(f) {
  if (!f || (!f.total.started && !f.total.finished && !f.total.paid)) return [];
  const t = f.total;
  return [
    'THE RITUAL, IN THE CAMERA',
    `Yesterday: ${f.day.started} ${f.day.started === 1 ? 'download' : 'downloads'} started · ${f.day.finished} finished · ${f.day.paid} paid (${money(f.day.minor)})`,
    `So far: ${t.finished} finished · ${t.paid} paid (${percent(t.paid, t.finished)} of finished) · ${money(t.minor)} supported, ${money(t.keptMinor)} after Stripe`
      + (t.paid ? ` · average ${money(Math.round(t.minor / t.paid))}` : ''),
    `Finished by file: ${f.files.map((x) => `${x.name} ${x.finished}`).join(' · ')}`,
    '',
  ];
}

export async function sendDigest(env, now = new Date()) {
  const to = env.DIGEST_TO?.trim();
  if (!to || !env.MAILER) return { sent: false, reason: 'not_configured' };
  const message = composeDigest(await gatherDigest(env, previousDay(now)));
  await env.MAILER.send({ to, from: DIGEST_FROM, replyTo: 'hello@latentstudios.art', ...message });
  return { sent: true, subject: message.subject };
}
