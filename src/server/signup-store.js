// The signup safety net (2026-10-17): Buttondown stopped accepting subscribers at its free plan's limit while a reel
// sent hundreds of people to /firmware, and every one of them saw "Something went wrong". Since then every signup is
// kept here first (db/newsletter-signups.sql, in the site's D1), then given to Buttondown; one Buttondown refuses
// stays here, marked, to be imported later. The table is created on first use, so no deploy step can forget it.

const CREATE = [
  `CREATE TABLE IF NOT EXISTS newsletter_signups (
     email TEXT PRIMARY KEY, tags TEXT NOT NULL DEFAULT '', first_at TEXT NOT NULL, last_at TEXT NOT NULL,
     buttondown_at TEXT, buttondown_error TEXT)`,
  'CREATE INDEX IF NOT EXISTS newsletter_signups_pending ON newsletter_signups (buttondown_at)',
];

const ready = new WeakMap();
function ensure(db) {
  if (!ready.has(db)) {
    ready.set(db, (async () => { for (const sql of CREATE) await db.prepare(sql).run(); })()
      .catch((error) => { ready.delete(db); throw error; }));
  }
  return ready.get(db);
}

/// The one spelling an address is kept under.
export const signupKey = (email) => String(email).trim().toLowerCase();

/// Keeps a signup (or adds its tags to one already kept). True when it is safely stored.
export async function keepSignup(db, email, tags = []) {
  if (!db) return false;
  try {
    await ensure(db);
    const key = signupKey(email);
    const now = new Date().toISOString();
    const row = await db.prepare('SELECT tags FROM newsletter_signups WHERE email = ?1').bind(key).first();
    const merged = [...new Set([...(row?.tags ? row.tags.split(',') : []), ...tags].filter(Boolean))].join(',');
    await db.prepare(
      'INSERT INTO newsletter_signups (email, tags, first_at, last_at) VALUES (?1, ?2, ?3, ?3) '
        + 'ON CONFLICT (email) DO UPDATE SET tags = ?2, last_at = ?3',
    ).bind(key, merged, now).run();
    return true;
  } catch {
    return false;
  }
}

/// Buttondown's answer for a kept signup: its time when it has the address, or the reason it refused.
export async function noteButtondown(db, email, error = null) {
  if (!db) return;
  try {
    await ensure(db);
    await db.prepare(
      error === null
        ? 'UPDATE newsletter_signups SET buttondown_at = ?2, buttondown_error = NULL WHERE email = ?1'
        : 'UPDATE newsletter_signups SET buttondown_error = ?2 WHERE email = ?1',
    ).bind(signupKey(email), error === null ? new Date().toISOString() : String(error).slice(0, 300)).run();
  } catch { /* the signup is kept either way */ }
}
